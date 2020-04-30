// Copyright (c) 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

nassh.sftp = {};

/**
 * @typedef {{
 *     flags: number,
 *     size: (number|undefined),
 *     uid: (number|undefined),
 *     gid: (number|undefined),
 *     permissions: (number|undefined),
 *     isCharacterDevice: (boolean|undefined),
 *     isDirectory: (boolean|undefined),
 *     isBlockDevice: (boolean|undefined),
 *     isRegularFile: (boolean|undefined),
 *     isFifo: (boolean|undefined),
 *     isLink: (boolean|undefined),
 *     isSocket: (boolean|undefined),
 *     lastAccessed: (number|undefined),
 *     lastModified: (number|undefined),
 *     extendedCount: (number|undefined),
 *     extensions: (!Array<{type: string, data: string}>|undefined),
 * }}
 */
nassh.sftp.FileAttrs;

/**
 * @typedef {{
 *     filename: string,
 *     longFilename: string,
 * }}
 */
nassh.sftp.File;

/** @typedef {string} */
nassh.sftp.FileHandle;

/**
 * A SFTP Client that manages the sending and receiving of SFTP packets.
 *
 * @param {string=} basePath The base directory for client requests.
 * @constructor
 */
nassh.sftp.Client = function(basePath = '') {
  // The version of the protocol we're using.
  this.protocolClientVersion = 3;

  // Extensions that the server supports.
  this.protocolServerVersion = null;
  this.protocolServerExtensions = {};

  // The packet request id counter.
  this.requestId_ = 0;

  // The nacl plugin for communication.
  this.plugin_ = null;

  // Whether the SFTP connection has been initialized
  this.isInitialised = false;

  // Directory to prefix all path requests.
  if (basePath) {
    // Make sure the path always ends with a slash.  This simplifies
    // the path logic in the rest of the client.
    if (!basePath.endsWith('/')) {
      basePath += '/';
    }
  }
  this.basePath_ = basePath;

  // The buffered packet data coming from the plugin.
  this.pendingMessageSize_ = null;
  this.buffer_ = nassh.buffer.new(/* autoack= */ true);

  // A map of pending packet requests.
  // Takes a requestId for a key and a Promise as a value.
  this.pendingRequests_ = {};

  // A map of currently opened files.
  // Takes a openRequestId for a key and a file handle as a value.
  this.openedFiles = {};
};

/**
 * Maximum data size that is guaranteed to work (read or write).
 *
 * This is used in scenarios where we need the packet to not be split up.
 * Otherwise, people should use the other {read,write}ChunkSize settings.
 *
 * This is not the same as the maximum protocol packet size which is slightly
 * larger (34000 bytes) which includes lower level framing (e.g. the various
 * SFTP packet lengths and headers).
 *
 * We only use these constants when doing data transfers where we strongly
 * care about throughput.
 */
nassh.sftp.Client.prototype.protocolChunkSize = 32 * 1024;

/**
 * Default data size with read packets.
 *
 * The server might support larger transfer sizes, so clients could request
 * really large sizes and see what the server responds with.  We stick to
 * smaller known sizes to keep code simpler.
 *
 * OpenSSH has supported 64KiB as its max read packet data size since at least
 * 2.3.0 released in Nov 2000.  Should be long enough to assume it works, so
 * we'll upgrade to that once we're confident we're talking to OpenSSH.
 *
 * As with protocolChunkSize, note that this size does not cover the entire
 * SFTP packet (e.g. headers and such), only the |len| field of SSH_FXP_READ
 * packets, and the length of the |data| string in the SSH_FXP_DATA response.
 */
nassh.sftp.Client.prototype.readChunkSize =
    nassh.sftp.Client.prototype.protocolChunkSize;

/**
 * Default data size with write packets.
 *
 * Unlike read requests where the server can respond with shorter sizes, the
 * server can't stop clients from trying to send really large packets.  The
 * RFC says people should limit themselves to 32KiB.  If a request is too large
 * for the server to process, it will simply break/kill the connection.
 *
 * OpenSSH has supported 256KiB as its max packet size since at least 2.3.0
 * released in Nov 2000.  Should be long enough to assume it works, so we'll
 * upgrade to that once we're confident we're talking to OpenSSH.
 *
 * Note that the 256KiB limit is for the entire packet, not just the length of
 * the |data| field in SSH_FXP_WRITE packets, so we use 255KiB here.
 */
nassh.sftp.Client.prototype.writeChunkSize =
    nassh.sftp.Client.prototype.protocolChunkSize;

/**
 * Stream wants to write some packet data to the client.
 *
 * @param {!ArrayBuffer} data
 */
nassh.sftp.Client.prototype.writeStreamData = function(data) {
  // Add this data chunk to the queued buffer.
  this.buffer_.write(data);

  // Loop over buffer until all available packets have been handled.
  while (this.parseBuffer_()) {
    continue;
  }
};

/**
 * Parse the buffer and process the first valid packet in it, else return false.
 *
 * @return {boolean}
 */
nassh.sftp.Client.prototype.parseBuffer_ = function() {
  // See if we've scanned the message length yet (first 4 bytes).
  if (this.pendingMessageSize_ === null) {
    if (this.buffer_.getUnreadCount() < 4) {
      return false;
    }

    // Pull out the 32-bit message length.
    const bytes = this.buffer_.read(4);
    const dv = new DataView(bytes.buffer, bytes.byteOffset);
    this.pendingMessageSize_ = dv.getUint32(0);
  }

  // See if we've got the entire packet yet.
  if (this.buffer_.getUnreadCount() < lib.notNull(this.pendingMessageSize_)) {
    return false;
  }

  // Pull out the packet from the buffer.
  const data = this.buffer_.read(this.pendingMessageSize_);
  // Restart the message process.
  this.pendingMessageSize_ = null;

  // Create packet containing the buffer.
  const packet = new nassh.sftp.Packet(data);

  // onPacket handler will return true if valid, else false.
  return this.onPacket(packet);
};

/**
 * onPacket handler. Will read the response packet's type and find the
 * requesting packet's callback. If the response packet is valid and has a valid
 * request id, it will be returned with the callback. Finding and executing
 * a callback will return true, else will return false if an error occurred.
 *
 * @param {!nassh.sftp.Packet} packet
 * @return {boolean}
 */
nassh.sftp.Client.prototype.onPacket = function(packet) {
  const packetType = packet.getUint8();

  // Obtain the response packet's constructor and create it.
  const ResponseType = nassh.sftp.packets.ResponsePackets[packetType]
      || nassh.sftp.packets.UnknownPacket;
  const responsePacket = new ResponseType(packet);

  // get request id and execute the callback (if found)
  const requestId = responsePacket.requestId;
  if (this.pendingRequests_.hasOwnProperty(requestId)) {
    this.pendingRequests_[requestId](responsePacket);
    delete this.pendingRequests_[requestId];
  } else {
    throw new TypeError('Received reply to unknown request:', requestId);
  }
  return true;
};

/**
 * Initializes SFTP connection.
 *
 * @param {!HTMLEmbedElement} plugin
 */
nassh.sftp.Client.prototype.initConnection = function(plugin) {
  this.plugin_ = plugin;
  this.init();
};

/**
 * Send a message to the nassh plugin.
 *
 * @param {string} name The name of the message to send.
 * @param {!Array} args The message arguments.
 */
nassh.sftp.Client.prototype.sendToPlugin_ = function(name, args) {
  this.plugin_.postMessage({name: name, arguments: args});
};


/**
 * Sends a SFTP request and awaits the response.
 *
 * @param {number|string} type SFTP packet type of outgoing request.
 * @param {!nassh.sftp.Packet} data The body of the request (not including
 *    length, type and requestId)
 * @return {!Promise<!nassh.sftp.Packet>} A Promise that resolves with the
 *     response packet
 */
nassh.sftp.Client.prototype.sendRequest_ = function(type, data) {
  if (!this.isInitialised) {
    throw new Error('Tried sending a SFTP request before the connection had'
                    + ' been initialized.');
  }

  // First construct the packet type portion of the packet header.
  const requestId = this.requestId_++;
  const packetType = new nassh.sftp.Packet();
  if (typeof type == 'string') {
    // Handle extended packets.
    packetType.setUint8(nassh.sftp.packets.RequestPackets.EXTENDED);
    packetType.setUint32(requestId);
    packetType.setString(type);
  } else {
    // Handle protocol defined packets.
    packetType.setUint8(type);
    packetType.setUint32(requestId);
  }

  // Now create a packet with the total length, followed by the packet type,
  // followed by the payload.  A bit backwards.
  const length = data.getLength() + packetType.getLength();
  const packet = new nassh.sftp.Packet(length + 4);
  packet.setUint32(length);
  packet.setData(packetType.toByteArray());
  packet.setData(data.toByteArray());

  return new Promise((resolve) => {
    this.pendingRequests_[requestId] = resolve;
    this.sendToPlugin_('onRead', [0, packet.toArrayBuffer()]);
  });
};

/**
 * Checks to see whether the response packet is of the expected type or not.
 *
 * @param {!nassh.sftp.Packet} responsePacket
 * @param {function(new:nassh.sftp.Packet,
 *     !nassh.sftp.Packet)} expectedPacketType Type of expected packet.
 * @param {string} requestType
 * @return {!nassh.sftp.Packet}
 */
nassh.sftp.Client.prototype.isExpectedResponse_ = function(responsePacket,
    expectedPacketType, requestType) {
  if (responsePacket instanceof nassh.sftp.packets.StatusPacket) {
    throw new nassh.sftp.StatusError(responsePacket, requestType);
  }

  if (!(responsePacket instanceof expectedPacketType)) {
    throw new TypeError('Received unexpected response to '
                        + requestType + ' packet: ' + responsePacket);
  }

  return responsePacket;
};

/**
 * Checks to see whether the response packet was a successful status packet.
 *
 * @param {!nassh.sftp.Packet} responsePacket
 * @param {string} requestType
 * @return {!nassh.sftp.Packet}
 */
nassh.sftp.Client.prototype.isSuccessResponse_ = function(responsePacket,
    requestType) {
  if (!(responsePacket instanceof nassh.sftp.packets.StatusPacket)) {
        throw new TypeError('Received unexpected response to '
                            + requestType + ' packet: ' + responsePacket);
  }

  if (responsePacket.code != nassh.sftp.packets.StatusCodes.OK) {
    throw new nassh.sftp.StatusError(responsePacket, requestType);
  }

  return responsePacket;
};

/**
 * Checks to see whether the response packet was a name packet.
 *
 * @param {!nassh.sftp.Packet} responsePacket
 * @param {string} requestType
 * @return {!nassh.sftp.Packet}
 */
nassh.sftp.Client.prototype.isNameResponse_ = function(responsePacket,
    requestType) {
  if (responsePacket instanceof nassh.sftp.packets.StatusPacket) {
    if (responsePacket.code != nassh.sftp.packets.StatusCodes.EOF) {
      throw new nassh.sftp.StatusError(responsePacket, requestType);
    }

    // EOF
    return responsePacket;
  }

  if (!(responsePacket instanceof nassh.sftp.packets.NamePacket)) {
    throw new TypeError('Received unexpected response to '
                        + requestType + ' packet: ' + responsePacket);
  }

  return responsePacket;
};


/**
 * Sends a SFTP init packet.
 */
nassh.sftp.Client.prototype.init = function() {
  const packet = new nassh.sftp.Packet();
  packet.setUint32(5); // length, 5 bytes for type and version fields
  packet.setUint8(nassh.sftp.packets.RequestPackets.INIT);
  packet.setUint32(this.protocolClientVersion);

  this.pendingRequests_['init'] = (packet) => {
    console.log('init: SFTP');
    this.onInit();
    this.protocolServerVersion = packet.version;
    this.protocolServerExtensions = packet.extensions;

    // See if the server is OpenSSH.  Checking for this particular protocol
    // extension isn't an exact match, but should be good enough for now.
    if (this.protocolServerExtensions['fstatvfs@openssh.com'] == '2') {
      // See the comments for this class constant for details.
      this.readChunkSize = 64 * 1024;
      this.writeChunkSize = 255 * 1024;
    }

    this.isInitialised = true;
  };
  this.sendToPlugin_('onRead', [0, packet.toArrayBuffer()]);
};


/**
 * Callback for users when we finished initialization.
 */
nassh.sftp.Client.prototype.onInit = function() {};


/**
 * Retrieves status information for a remote file.
 *
 * @param {string} path The path of the remote file
 * @return {!Promise<!nassh.sftp.FileAttrs>} A Promise that resolves with the
 *     remote file attributes, or rejects (usually with an
 *     nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.fileStatus = function(path) {
  const packet = new nassh.sftp.Packet();
  packet.setUtf8String(this.basePath_ + path);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.STAT, packet)
      .then((response) => {
        return this.isExpectedResponse_(
            response, nassh.sftp.packets.AttrsPacket, 'STAT');
      })
      .then((response) => response.attrs);
};


/**
 * Retrieves status information for a remote symlink.
 *
 * @param {string} path The path of the remote symlink
 * @return {!Promise<!nassh.sftp.FileAttrs>} A Promise that resolves with the
 *     remote file attributes, or rejects (usually with an
 *     nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.linkStatus = function(path) {
  const packet = new nassh.sftp.Packet();
  packet.setUtf8String(this.basePath_ + path);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.LSTAT, packet)
      .then((response) => {
        return this.isExpectedResponse_(
              response, nassh.sftp.packets.AttrsPacket, 'LSTAT');
      })
      .then((response) => response.attrs);
};


/**
 * Retrieves status information for a remote file handle.
 *
 * @param {string} handle The open file handle
 * @return {!Promise<!nassh.sftp.FileAttrs>} A Promise that resolves  with the
 *     remote file attributes, or rejects (usually with an
 *     nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.fileHandleStatus = function(handle) {
  const packet = new nassh.sftp.Packet();
  packet.setString(handle);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.FSTAT, packet)
      .then((response) => {
        return this.isExpectedResponse_(
            response, nassh.sftp.packets.AttrsPacket, 'FSTAT');
      })
      .then((response) => response.attrs);
};

/**
 * Sets status information for a remote file.
 *
 * @param {string} path The path of the remote file
 * @param {!nassh.sftp.FileAttrs} attrs The file attributes to set (see the
 *     structure nassh.sftp.packets.getFileAttrs sets up)
 * @return {!Promise<!nassh.sftp.packets.AttrsPacket>} A Promise that resolves
 *     with the remote file attributes, or rejects (usually with an
 *     nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.setFileStatus = function(path, attrs) {
  const packet = new nassh.sftp.Packet();
  packet.setUtf8String(this.basePath_ + path);
  nassh.sftp.packets.setFileAttrs(packet, attrs);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.SETSTAT, packet)
    .then((response) => this.isSuccessResponse_(response, 'SETSTAT'));
};

/**
 * Sets status information for a remote file handle.
 *
 * @param {string} handle The open file handle
 * @param {!nassh.sftp.FileAttrs} attrs The file attributes to set (see the
 *     structure nassh.sftp.packets.getFileAttrs sets up)
 * @return {!Promise<!nassh.sftp.packets.AttrsPacket>} A Promise that resolves
 *     with the remote file attributes, or rejects (usually with an
 *     nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.setFileHandleStatus = function(handle, attrs) {
  const packet = new nassh.sftp.Packet();
  packet.setString(handle);
  nassh.sftp.packets.setFileAttrs(packet, attrs);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.FSETSTAT, packet)
    .then((response) => this.isSuccessResponse_(response, 'FSETSTAT'));
};


/**
 * Opens a remote directory.
 *
 * @param {string} path The path of the remote directory
 * @return {!Promise<string>} A Promise that resolves with the remote
 *    directory handle, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.openDirectory = function(path) {
  const packet = new nassh.sftp.Packet();
  packet.setUtf8String(this.basePath_ + path);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.OPENDIR, packet)
      .then((response) => {
        return this.isExpectedResponse_(
            response, nassh.sftp.packets.HandlePacket, 'OPENDIR');
      })
      .then((response) => response.handle);
};


/**
 * Reads the contents of a remote directory.
 *
 * @param {string} handle The handle of the remote directory
 * @return {!Promise<!nassh.sftp.packets.NamePacket>} A Promise that resolves
 *     with the remote directory contents, or rejects (usually with an
 *     nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.readDirectory = function(handle) {
  const packet = new nassh.sftp.Packet();
  packet.setString(handle);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.READDIR, packet)
    .then((response) => this.isNameResponse_(response, 'READDIR'));
};

/**
 * List all the entries of a directory.
 *
 * This is a helper function to enumerate an entire directory with optional
 * filtering on each result.
 *
 * @param {string} handle The handle of the remote directory.
 * @param {function(!nassh.sftp.File)=} filter A callback function
 *     to filter results. The return value controls behavior: false will skip
 *     the entry, true will keep the entry, undefined will abort processing, a
 *     Promise will resolve (and its return will replace the entry if not
 *     falsy), and all other return values will replace the entry.
 * @return {!Array<!nassh.sftp.File>} A list of all the entries in
 *     this directory.
 */
nassh.sftp.Client.prototype.scanDirectory = function(handle, filter) {
  let entries = [];

  const nextRead = () => {
    return this.readDirectory(handle)
      .then((response) => {
        // If EOF, return all the directory entries.
        if (response instanceof nassh.sftp.packets.StatusPacket &&
            response.code == nassh.sftp.packets.StatusCodes.EOF) {
          return entries;
        }

        // Accumulate promises from the filter as needed.
        const promises = [];

        // Run the user's filter across this batch of files.
        for (let i = 0; i < response.fileCount; ++i) {
          let entry = response.files[i];

          if (filter) {
            const ret = filter(entry);
            if (ret === undefined) {
              return [];
            } else if (ret === false) {
              continue;
            } else if (ret instanceof Promise) {
              promises.push(ret);
              continue;
            } else if (ret !== true) {
              entry = ret;
            }
          }

          entries.push(entry);
        }

        // Resolve all the promises and accumulate any non-false results.
        return Promise.all(promises).then((results) => {
          entries = entries.concat(results.filter((result) => !!result));
        })
        .then(nextRead);
      });
  };

  return nextRead();
};

/**
 * Removes a remote directory.
 *
 * @param {string} path The path of the remote directory
 * @param {boolean=} recursive
 * @return {!Promise<!nassh.sftp.packets.StatusPacket>} A Promise that resolves
 *     or rejects with a nassh.sftp.StatusError.
 */
nassh.sftp.Client.prototype.removeDirectory = function(
    path, recursive = false) {
  // Low level directory remove packet.  Only works if the dir is already empty.
  const rmdir = (path) => {
    const packet = new nassh.sftp.Packet();
    packet.setUtf8String(this.basePath_ + path);

    return this.sendRequest_(nassh.sftp.packets.RequestPackets.RMDIR, packet)
      .then((response) => this.isSuccessResponse_(response, 'RMDIR'));
  };

  // Higher level function to recursively remove a directory.
  const removeDirectory = (path) => {
    let directoryHandle;
    return this.openDirectory(path)
      .then((handle) => { directoryHandle = handle; })
      .then(() => {
        return this.scanDirectory(directoryHandle, (entry) => {
          return (entry.filename != '.' && entry.filename != '..');
        });
      })
      .then((entries) => {
        const promises = [];

        // Recursively delete contents.
        for (let i = 0; i < entries.length; ++i) {
          const entry = entries[i];
          const fullpath = `${path}/${entry.filename}`;
          if (entry.isDirectory) {
            promises.push(removeDirectory(fullpath));
          } else {
            promises.push(this.removeFile(fullpath));
          }
        }

        return Promise.all(promises);
      })
      .finally(() => {
        if (directoryHandle !== undefined) {
          return this.closeFile(directoryHandle);
        }
      })
      .then(() => rmdir(path));
  };

  return recursive ? removeDirectory(path) : rmdir(path);
};


/**
 * Opens a remote file.
 *
 * @param {string} path The path of the remote file
 * @param {number} pflags The open flags for the remote file
 * @return {!Promise<!nassh.sftp.FileHandle>} A Promise that resolves with the
 *     remote file handle, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.openFile = function(path, pflags) {
  const packet = new nassh.sftp.Packet();
  packet.setUtf8String(this.basePath_ + path);
  packet.setUint32(pflags); // open flags
  packet.setUint32(0); // default attr values

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.OPEN, packet)
      .then((response) => {
        return this.isExpectedResponse_(
              response, nassh.sftp.packets.HandlePacket, 'OPEN');
      })
      .then((response) => response.handle);
};


/**
 * Read a chunk in a remote file.
 *
 * Note: The data returned might be smaller than the requested length when the
 * server caps the max per-chunk size.
 *
 * @param {string} handle The handle of the remote file
 * @param {number} offset The offset to start reading from
 * @param {number} len The maximum number of bytes to read
 * @return {!Promise<!Uint8Array>} A Promise that resolves with the remote
 *    file data, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.readChunk = function(handle, offset, len) {
  const packet = new nassh.sftp.Packet();
  packet.setString(handle);
  packet.setUint64(offset); // offset
  packet.setUint32(len); // max bytes per packet

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.READ, packet)
    .then((response) => {
      if (response instanceof nassh.sftp.packets.StatusPacket) {
        if (response.code != nassh.sftp.packets.StatusCodes.EOF) {
          throw new nassh.sftp.StatusError(response, 'READ');
        }
        return ''; // EOF, return empty data string
      }

      if (!(response instanceof nassh.sftp.packets.DataPacket)) {
        throw new TypeError('Received unexpected response to READ packet: '
                            + response);
      }

      return response.data;
  });
};

/**
 * Read all chunks in a remote file.
 *
 * Helper to read all the chunks of a file and pass each chunk to the user's
 * callback as they're read.
 *
 * TODO: This could be faster if we pipelined more by issuing lots of read
 * requests and processing the results in the background.  That would make
 * the code a lot more complicated and we'd have to deal with reassembling
 * the fragments.
 *
 * @param {string} handle The handle of the remote file.
 * @param {function(!ArrayBuffer)} callback The function called on every chunk.
 * @param {number=} offset The offset to start reading from.
 * @param {number=} length The maximum number of bytes to read.
 * @return {!Promise}
 */
nassh.sftp.Client.prototype.readChunks = function(
    handle, callback, offset = 0, length = undefined) {
  // How many bytes we've read so far.
  let bytesRead = 0;

  // Whether the callback has canceled further reads.
  let canceled = false;

  // Send a read request for the next chunk of data in the open handle.
  const doRead = () => {
    // How many bytes to try to read in this chunk.
    let bytesToRead = this.readChunkSize;

    // Check any size limits the caller has requested.
    if (length !== undefined) {
      if (bytesRead >= length) {
        return Promise.resolve();
      }

      const remaining = length - bytesRead;
      if (remaining < bytesToRead) {
        bytesToRead = remaining;
      }
    }

    // JS compiler needs help to know that default param offset is not
    // undefined when it is used in an inner function.
    // https://github.com/google/closure-compiler/issues/3327
    return this.readChunk(handle, lib.notUndefined(offset), bytesToRead)
      .then(processChunk);
  };

  // Process the resulting chunk of data.
  const processChunk = (chunk) => {
    // See if we've reached the end of the file.
    if (chunk.length == 0) {
      return;
    }

    // Update our counters as funcs below rely on them.
    offset += chunk.length;
    bytesRead += chunk.length;

    // Issue a new read request in the background.  If we end up getting
    // canceled before it returns, that's OK.  We assume the best and get
    // better performance most of the time.
    if (canceled) {
      return;
    }
    const ret = doRead();

    // Let the caller process this chunk.
    if (callback(chunk) === false) {
      canceled = true;
      return Promise.reject();
    }

    return ret;
  };

  // Kick off the process.
  return doRead();
};

/**
 * Open+read+close a file in its entirety.
 *
 * Helper to handle opening/closing a file, and processing all the chunks
 * automatically by calling the user's callback.
 *
 * @param {string} path The handle of the remote file.
 * @param {function(!ArrayBuffer)} callback The function called on every chunk.
 * @param {number=} offset The offset to start reading from.
 * @param {number=} length The maximum number of bytes to read.
 * @return {!Promise}
 */
nassh.sftp.Client.prototype.readFile = function(
      path, callback, offset = 0, length = undefined) {
  return this.openFile(path, nassh.sftp.packets.OpenFlags.READ)
    .then((handle) => {
      return this.readChunks(handle, callback, offset, length)
        .finally(() => this.closeFile(handle));
    });
};

/**
 * Closes a remote file handle.
 *
 * @param {string} handle The handle of the remote file
 * @return {!Promise<!nassh.sftp.packets.StatusPacket>} A Promise that resolves
 *     or rejects with a nassh.sftp.StatusError
 */
nassh.sftp.Client.prototype.closeFile = function(handle) {
  const packet = new nassh.sftp.Packet();
  packet.setString(handle);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.CLOSE, packet)
    .then((response) => this.isSuccessResponse_(response, 'CLOSE'));
};

/**
 * Copy data between two handles.
 *
 * Note: This requires the copy-data extension.  Callers should check for it
 * before trying to use.
 *
 * @param {string} readHandle The handle of the remote file to read.
 * @param {string} writeHandle The handle of the remote file to write.
 * @param {number=} length How many bytes to copy.
 * @param {number=} readOffset Offset into the read handle.
 * @param {number=} writeOffset Offset into the write handle.
 * @return {!Promise<!nassh.sftp.packets.StatusPacket>} A Promise that resolves
 *     or rejects with a nassh.sftp.StatusError
 */
nassh.sftp.Client.prototype.copyData = function(
    readHandle, writeHandle, length = 0, readOffset = 0, writeOffset = 0) {
  const packet = new nassh.sftp.Packet();
  packet.setString(readHandle);
  packet.setUint64(readOffset);
  packet.setUint64(length);
  packet.setString(writeHandle);
  packet.setUint64(writeOffset);

  return this.sendRequest_('copy-data', packet)
    .then((response) => this.isSuccessResponse_(response, 'copy-data'));
};

/**
 * Removes a remote file.
 *
 * @param {string} path The handle of the remote file
 * @return {!Promise<!nassh.sftp.packets.StatusPacket>} A Promise that resolves
 *     or rejects with a nassh.sftp.StatusError
 */
nassh.sftp.Client.prototype.removeFile = function(path) {
  const packet = new nassh.sftp.Packet();
  packet.setUtf8String(this.basePath_ + path);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.REMOVE, packet)
    .then((response) => this.isSuccessResponse_(response, 'REMOVE'));
};


/**
 * Renames the path name of a remote file.
 *
 * @param {string} sourcePath The source path of the remote file
 * @param {string} targetPath The target path of the remote file
 * @return {!Promise<!nassh.sftp.packets.StatusPacket>} A Promise that resolves
 *     or rejects with a nassh.sftp.StatusError
 */
nassh.sftp.Client.prototype.renameFile = function(sourcePath, targetPath) {
  const packet = new nassh.sftp.Packet();

  let type;
  if (this.protocolServerExtensions['posix-rename@openssh.com'] == '1') {
    type = 'posix-rename@openssh.com';
  } else {
    type = nassh.sftp.packets.RequestPackets.RENAME;
  }
  packet.setUtf8String(this.basePath_ + sourcePath);
  packet.setUtf8String(this.basePath_ + targetPath);

  return this.sendRequest_(type, packet)
    .then((response) => this.isSuccessResponse_(response, 'RENAME'));
};

/**
 * Write a chunk in a remote file.
 *
 * Note: The data written must not exceed writeChunkSize lest the server abort
 * the connection.
 *
 * @param {string} handle The handle of the remote file
 * @param {number} offset The offset to start writing from
 * @param {!Uint8Array} data The data to write
 * @return {!Promise<!nassh.sftp.packets.StatusPacket>} A Promise that resolves
 *     or rejects with a nassh.sftp.StatusError
 */
nassh.sftp.Client.prototype.writeChunk = function(handle, offset, data) {
  // Accept any typed array form.
  data = new Uint8Array(data);

  const packet = new nassh.sftp.Packet();
  packet.setString(handle);
  packet.setUint64(offset);
  packet.setUint32(data.length);
  packet.setData(data);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.WRITE, packet)
    .then((response) => this.isSuccessResponse_(response, 'WRITE'));
};


/**
 * Creates a new remote directory.
 *
 * @param {string} path The path of the remote directory
 * @return {!Promise<!nassh.sftp.packets.StatusPacket>} A Promise that resolves
 *     with the remote handle, or rejects (usually with an
 *     nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.makeDirectory = function(path) {
  const packet = new nassh.sftp.Packet();
  packet.setUtf8String(this.basePath_ + path);
  packet.setUint32(0); // flags, 0b0000, no modified attributes

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.MKDIR, packet)
    .then((response) => this.isSuccessResponse_(response, 'MKDIR'));
};


/**
 * Canonicalize a path.
 *
 * @param {string} path The path to canonicalize.
 * @return {!Promise<!nassh.sftp.packets.StatusPacket>} A Promise that resolves
 *     with the remote path, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.realPath = function(path) {
  const packet = new nassh.sftp.Packet();
  packet.setUtf8String(this.basePath_ + path);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.REALPATH, packet)
    .then((response) => this.isNameResponse_(response, 'REALPATH'));
};


/**
 * Read a symlink.
 *
 * @param {string} path The symlink to read.
 * @return {!Promise<!nassh.sftp.packets.NamePacket>} A Promise that resolves
 *     with the remote path, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.readLink = function(path) {
  const packet = new nassh.sftp.Packet();
  packet.setUtf8String(this.basePath_ + path);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.READLINK, packet)
    .then((response) => this.isNameResponse_(response, 'READLINK'));
};


/**
 * Create a symlink.
 *
 * Note: The SFTPv3 protocol says the order should be linkpath then targetpath,
 * but we're reversed to match OpenSSH.  See ../doc/hack.md for more details.
 *
 * @param {string} target The target of the symlink.
 * @param {string} path The symlink to create.
 * @return {!Promise<!nassh.sftp.packets.StatusPacket>} A Promise that resolves
 *     with the remote path, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.symLink = function(target, path) {
  const packet = new nassh.sftp.Packet();
  packet.setUtf8String(target);
  packet.setUtf8String(this.basePath_ + path);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.SYMLINK, packet)
    .then((response) => this.isSuccessResponse_(response, 'SYMLINK'));
};

/**
 * Create a hardlink.
 *
 * This requires the hardlink@openssh.com extension.
 *
 * @param {string} oldpath The existing path to link to.
 * @param {string} newpath The new path to create.
 * @return {!Promise<!nassh.sftp.packets.StatusPacket>} A Promise that resolves
 *     or rejects with a nassh.sftp.StatusError.
 */
nassh.sftp.Client.prototype.hardLink = function(oldpath, newpath) {
  if (this.protocolServerExtensions['hardlink@openssh.com'] != '1') {
    throw new nassh.sftp.StatusError({
      'code': nassh.sftp.packets.StatusCodes.OP_UNSUPPORTED,
      'message': 'hardlink@openssh.com not supported',
    }, 'HARDLINK');
  }

  const packet = new nassh.sftp.Packet();
  packet.setUtf8String(this.basePath_ + oldpath);
  packet.setUtf8String(this.basePath_ + newpath);

  return this.sendRequest_('hardlink@openssh.com', packet)
    .then((response) => this.isSuccessResponse_(response, 'HARDLINK'));
};

/**
 * Stat the filesystem.
 *
 * This requires the statvfs@openssh.com extension.
 *
 * @param {string} path The path to stat the underlying filesystem.
 * @return {!Promise<!nassh.sftp.packets.StatusPacket>} A Promise that resolves
 *     or rejects with a nassh.sftp.StatusError.
 */
nassh.sftp.Client.prototype.statvfs = function(path) {
  if (this.protocolServerExtensions['statvfs@openssh.com'] != '2') {
    throw new nassh.sftp.StatusError({
      'code': nassh.sftp.packets.StatusCodes.OP_UNSUPPORTED,
      'message': 'statvfs@openssh.com not supported',
    }, 'STATVFS');
  }

  const packet = new nassh.sftp.Packet();
  packet.setUtf8String(this.basePath_ + path);

  return this.sendRequest_('statvfs@openssh.com', packet)
    .then((response) => {
      return this.isExpectedResponse_(
          response, nassh.sftp.packets.ExtendedReplyPacket, 'STATVFS');
    })
    .then((response) => new nassh.sftp.packets.DiskFreePacket(response));
};

/**
 * Sync the open handle.
 *
 * This requires the fsync@openssh.com extension.
 *
 * @param {string} handle The handle of the remote file.
 * @return {!Promise<!nassh.sftp.packets.StatusPacket>} A Promise that resolves
 *     or rejects with a nassh.sftp.StatusError.
 */
nassh.sftp.Client.prototype.fsync = function(handle) {
  if (this.protocolServerExtensions['fsync@openssh.com'] != '1') {
    throw new nassh.sftp.StatusError({
      'code': nassh.sftp.packets.StatusCodes.OP_UNSUPPORTED,
      'message': 'fsync@openssh.com not supported',
    }, 'FSYNC');
  }

  const packet = new nassh.sftp.Packet();
  packet.setString(handle);

  return this.sendRequest_('fsync@openssh.com', packet)
    .then((response) => this.isSuccessResponse_(response, 'FSYNC'));
};
