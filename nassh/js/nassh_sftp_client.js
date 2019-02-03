// Copyright (c) 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

nassh.sftp = {};

/**
 * A SFTP Client that manages the sending and receiving of SFTP packets.
 *
 * @param {string} [opt_basePath] The base directory for client requests.
 */
nassh.sftp.Client = function(opt_basePath='') {
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
  if (opt_basePath) {
    // Make sure the path always ends with a slash.  This simplifies
    // the path logic in the rest of the client.
    if (!opt_basePath.endsWith('/'))
      opt_basePath += '/';
  }
  this.basePath_ = opt_basePath;

  // The buffered packet data coming from the plugin.
  this.buffer_ = '';

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
 */
nassh.sftp.Client.prototype.writeStreamData = function(data) {
  // add data to buffer
  this.buffer_ += data;

  // loop over buffer until all packets have been handled.
  try {
    var rv = true;
    // Exit on false return value, else keep looping through valid packets
    while(rv && this.buffer_.length > 4) { // 4 bytes needed to read len field
      rv = this.parseBuffer();
    }
  } catch (e) {
    console.warn(e.name + ': ' + e.message);
    console.warn(e.stack);
  }
};

/**
 * Parse the buffer and process the first valid packet in it, else return false.
 */
nassh.sftp.Client.prototype.parseBuffer = function() {
  // create packet containing the buffer
  var packet = new nassh.sftp.Packet(this.buffer_);

  // get packet data length
  var dataLength = packet.getUint32();

  // check the buffer contains a full and valid packet
  if (dataLength > this.buffer_.length - 4 && dataLength > 4) {
    return false;
  }

  // slice buffer packet to contain the expected packet
  packet.slice(0, dataLength + 4);

  // remove the expected packet from buffer
  this.buffer_ = this.buffer_.substr(packet.getLength());

  // onPacket handler, will return true if valid, else false
  var rv = this.onPacket(packet);
  return rv;
};

/**
 * onPacket handler. Will read the response packet's type and find the
 * requesting packet's callback. If the response packet is valid and has a valid
 * request id, it will be returned with the callback. Finding and executing
 * a callback will return true, else will return false if an error occurred.
 */
nassh.sftp.Client.prototype.onPacket = function(packet) {
  var packetType = packet.getUint8();

  // Obtain the response packet's constructor and create it.
  var ResponseType = nassh.sftp.packets.ResponsePackets[packetType]
      || nassh.sftp.UnknownPacket;
  var responsePacket = new ResponseType(packet);

  // get request id and execute the callback (if found)
  var requestId = responsePacket.requestId;
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
 */
nassh.sftp.Client.prototype.initConnection = function(plugin) {
  this.plugin_ = plugin;
  this.init();
};


/**
 * Send a message to the nassh plugin.
 *
 * @param {string} name The name of the message to send.
 * @param {Array} arguments The message arguments.
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
 * @return {!Promise} A Promise that resolves with the response packet
 */
nassh.sftp.Client.prototype.sendRequest_ = function(type, data) {
  if (!this.isInitialised) {
    throw new Error('Tried sending a SFTP request before the connection had'
                    + ' been initialized.');
  }

  // First construct the packet type portion of the packet header.
  var requestId = this.requestId_++;
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
  const packet = new nassh.sftp.Packet();
  packet.setUint32(data.getLength() + packetType.getLength());
  packet.setData(packetType.toString());
  packet.setData(data);

  return new Promise(resolve => {
    this.pendingRequests_[requestId] = resolve;
    this.sendToPlugin_('onRead', [0, packet.toByteArray()]);
  });
};


/**
 * Checks to see whether the response packet is of the expected type or not.
 */
nassh.sftp.Client.prototype.isExpectedResponse_ = function(responsePacket,
    expectedPacket, requestType) {
  if (responsePacket instanceof nassh.sftp.packets.StatusPacket) {
    throw new nassh.sftp.StatusError(responsePacket, requestType);
  }

  if (!(responsePacket instanceof expectedPacket)) {
    throw new TypeError('Received unexpected response to '
                        + requestType + ' packet: ' + responsePacket);
  }

  return responsePacket;
};


/**
 * Checks to see whether the response packet was a successful status packet.
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
 */
nassh.sftp.Client.prototype.isNameResponse_ = function(responsePacket,
    requestType) {
  if (responsePacket instanceof nassh.sftp.packets.StatusPacket) {
    if (responsePacket.code != nassh.sftp.packets.StatusCodes.EOF)
      throw new nassh.sftp.StatusError(responsePacket, requestType);

    // EOF
    return responsePacket;
  }

  if (!(responsePacket instanceof nassh.sftp.packets.NamePacket))
    throw new TypeError('Received unexpected response to '
                        + requestType + ' packet: ' + responsePacket);

  return responsePacket;
};


/**
 * Sends a SFTP init packet.
 */
nassh.sftp.Client.prototype.init = function() {
  var packet = new nassh.sftp.Packet();
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
  this.sendToPlugin_('onRead', [0, packet.toByteArray()]);
};


/**
 * Callback for users when we finished initialization.
 */
nassh.sftp.Client.prototype.onInit = function() {};


/**
 * Retrieves status information for a remote file.
 *
 * @param {string} path The path of the remote file
 * @return {!Promise<!AttrsPacket>} A Promise that resolves with the remote
 *    file attributes, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.fileStatus = function(path) {
  var packet = new nassh.sftp.Packet();
  packet.setString(lib.encodeUTF8(this.basePath_ + path));

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.STAT, packet)
    .then(response => this.isExpectedResponse_(response, nassh.sftp.packets.AttrsPacket, 'STAT'))
    .then(response => response.attrs);
};


/**
 * Retrieves status information for a remote symlink.
 *
 * @param {string} path The path of the remote symlink
 * @return {!Promise<!AttrsPacket>} A Promise that resolves with the remote
 *    file attributes, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.linkStatus = function(path) {
  var packet = new nassh.sftp.Packet();
  packet.setString(lib.encodeUTF8(this.basePath_ + path));

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.LSTAT, packet)
    .then(response => this.isExpectedResponse_(response, nassh.sftp.packets.AttrsPacket, 'LSTAT'))
    .then(response => response.attrs);
};


/**
 * Retrieves status information for a remote file handle.
 *
 * @param {string} handle The open file handle
 * @return {!Promise<!AttrsPacket>} A Promise that resolves with the remote
 *    file attributes, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.fileHandleStatus = function(handle) {
  var packet = new nassh.sftp.Packet();
  packet.setString(handle);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.FSTAT, packet)
    .then(response => this.isExpectedResponse_(response, nassh.sftp.packets.AttrsPacket, 'FSTAT'))
    .then(response => response.attrs);
};


/**
 * Sets status information for a remote file.
 *
 * @param {string} path The path of the remote file
 * @param {Object} attrs The file attributes to set (see the structure
 *    nassh.sftp.packets.getFileAttrs sets up)
 * @return {!Promise<!AttrsPacket>} A Promise that resolves with the remote
 *    file attributes, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.setFileStatus = function(path, attrs) {
  var packet = new nassh.sftp.Packet();
  packet.setString(lib.encodeUTF8(this.basePath_ + path));
  nassh.sftp.packets.setFileAttrs(packet, attrs);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.SETSTAT, packet)
    .then(response => this.isSuccessResponse_(response, 'SETSTAT'));
};


/**
 * Sets status information for a remote file handle.
 *
 * @param {string} handle The open file handle
 * @param {Object} attrs The file attributes to set (see the structure
 *    nassh.sftp.packets.getFileAttrs sets up)
 * @return {!Promise<!AttrsPacket>} A Promise that resolves with the remote
 *    file attributes, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.setFileHandleStatus = function(handle, attrs) {
  var packet = new nassh.sftp.Packet();
  packet.setString(handle);
  nassh.sftp.packets.setFileAttrs(packet, attrs);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.FSETSTAT, packet)
    .then(response => this.isSuccessResponse_(response, 'FSETSTAT'));
};


/**
 * Opens a remote directory.
 *
 * @param {string} path The path of the remote directory
 * @return {!Promise<!HandlePacket>} A Promise that resolves with the remote
 *    directory handle, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.openDirectory = function(path) {
  var packet = new nassh.sftp.Packet();
  packet.setString(lib.encodeUTF8(this.basePath_ + path));

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.OPENDIR, packet)
    .then(response => this.isExpectedResponse_(response, nassh.sftp.packets.HandlePacket, 'OPENDIR'))
    .then(response => response.handle);
};


/**
 * Reads the contents of a remote directory.
 *
 * @param {string} handle The handle of the remote directory
 * @return {!Promise<!NamePacket>} A Promise that resolves with the remote
 *    directory contents, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.readDirectory = function(handle) {
  var packet = new nassh.sftp.Packet();
  packet.setString(handle);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.READDIR, packet)
    .then(response => this.isNameResponse_(response, 'READDIR'));
};

/**
 * List all the entries of a directory.
 *
 * This is a helper function to enumerate an entire directory with optional
 * filtering on each result.
 *
 * @param {string} handle The handle of the remote directory.
 * @param {function(NamePacket)=} filter A callback function to filter results.
 *    The return value controls behavior: false will skip the entry, true will
 *    keep the entry, undefined will abort processing, and all other return
 *    values will replace the entry.
 * @return {Array<NamePacket>} A list of all the entries in this directory.
 */
nassh.sftp.Client.prototype.scanDirectory = function(handle, filter=undefined) {
  const entries = [];

  const nextRead = () => {
    return this.readDirectory(handle)
      .then((response) => {
        // If EOF, return all the directory entries.
        if (response instanceof nassh.sftp.packets.StatusPacket &&
            response.code == nassh.sftp.packets.StatusCodes.EOF) {
          return entries;
        }

        // Run the user's filter across this batch of files.
        for (let i = 0; i < response.fileCount; ++i) {
          let entry = response.files[i];

          if (filter) {
            const ret = filter(entry);
            if (ret === undefined) {
              return [];
            } else if (ret === false) {
              continue;
            } else if (ret !== true) {
              entry = ret;
            }
          }

          entries.push(entry);
        }

        return nextRead();
      });
  };

  return nextRead();
};

/**
 * Removes a remote directory.
 *
 * @param {string} path The path of the remote directory
 * @return {!Promise<!StatusPacket>} A Promise that resolves or rejects with
 *    a nassh.sftp.StatusError.
 */
nassh.sftp.Client.prototype.removeDirectory = function(path, recursive=false) {
  // Low level directory remove packet.  Only works if the dir is already empty.
  const rmdir = (path) => {
    const packet = new nassh.sftp.Packet();
    packet.setString(lib.encodeUTF8(this.basePath_ + path));

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
 * @return {!Promise<!HandlePacket>} A Promise that resolves with the remote
 *    file handle, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.openFile = function(path, pflags) {
  var packet = new nassh.sftp.Packet();
  packet.setString(lib.encodeUTF8(this.basePath_ + path));
  packet.setUint32(pflags); // open flags
  packet.setUint32(0); // default attr values

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.OPEN, packet)
    .then(response => this.isExpectedResponse_(response, nassh.sftp.packets.HandlePacket, 'OPEN'))
    .then(response => response.handle);
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
 * @return {!Promise<!DataPacket>} A Promise that resolves with the remote
 *    file data, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.readChunk = function(handle, offset, len) {
  var packet = new nassh.sftp.Packet();
  packet.setString(handle);
  packet.setUint64(offset); //offset
  packet.setUint32(len); // max bytes per packet

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.READ, packet)
    .then(response => {
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
 * @param {function(string)} callback The function called on every chunk.
 * @param {number?} offset The offset to start reading from.
 * @param {number?} length The maximum number of bytes to read.
 */
nassh.sftp.Client.prototype.readChunks = function(handle, callback,
                                                  {offset=0, length}={}) {
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

    return this.readChunk(handle, offset, bytesToRead)
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
    let ret = doRead();

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
 * @param {string} handle The handle of the remote file.
 * @param {function(string)} callback The function called on every chunk.
 * @param {number?} offset The offset to start reading from.
 * @param {number?} length The maximum number of bytes to read.
 */
nassh.sftp.Client.prototype.readFile = function(path, callback,
                                                {offset=0, length}={}) {
  return this.openFile(path, nassh.sftp.packets.OpenFlags.READ)
    .then((handle) => {
      return this.readChunks(handle, callback, {offset: offset, length: length})
        .finally(() => this.closeFile(handle));
    });
};

/**
 * Closes a remote file handle.
 *
 * @param {string} handle The handle of the remote file
 * @return {!Promise<!StatusPacket>} A Promise that resolves or rejects with
 *    a nassh.sftp.StatusError
 */
nassh.sftp.Client.prototype.closeFile = function(handle) {
  var packet = new nassh.sftp.Packet();
  packet.setString(handle);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.CLOSE, packet)
    .then(response => this.isSuccessResponse_(response, 'CLOSE'));
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
 * @return {!Promise<!StatusPacket>} A Promise that resolves or rejects with
 *    a nassh.sftp.StatusError
 */
nassh.sftp.Client.prototype.copyData =
    function(readHandle, writeHandle, length=0, readOffset=0, writeOffset=0) {
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
 * @param {string} handle The handle of the remote file
 * @return {!Promise<!StatusPacket>} A Promise that resolves or rejects with
 *    a nassh.sftp.StatusError
 */
nassh.sftp.Client.prototype.removeFile = function(path) {
  var packet = new nassh.sftp.Packet();
  packet.setString(lib.encodeUTF8(this.basePath_ + path));

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.REMOVE, packet)
    .then(response => this.isSuccessResponse_(response, 'REMOVE'));
};


/**
 * Renames the path name of a remote file.
 *
 * @param {string} sourcePath The source path of the remote file
 * @param {string} targetPath The target path of the remote file
 * @return {!Promise<!StatusPacket>} A Promise that resolves or rejects with
 *    a nassh.sftp.StatusError
 */
nassh.sftp.Client.prototype.renameFile = function(sourcePath, targetPath) {
  var packet = new nassh.sftp.Packet();

  let type;
  if (this.protocolServerExtensions['posix-rename@openssh.com'] == '1') {
    type = 'posix-rename@openssh.com';
  } else {
    type = nassh.sftp.packets.RequestPackets.RENAME;
  }
  packet.setString(lib.encodeUTF8(this.basePath_ + sourcePath));
  packet.setString(lib.encodeUTF8(this.basePath_ + targetPath));

  return this.sendRequest_(type, packet)
    .then(response => this.isSuccessResponse_(response, 'RENAME'));
};


/**
 * Write a chunk in a remote file.
 *
 * Note: The data written must not exceed writeChunkSize lest the server abort
 * the connection.
 *
 * @param {string} handle The handle of the remote file
 * @param {number} offset The offset to start writing from
 * @param {string} data The data to write
 * @return {!Promise<!StatusPacket>} A Promise that resolves or rejects with
 *    a nassh.sftp.StatusError
 */
nassh.sftp.Client.prototype.writeChunk = function(handle, offset, data) {
  var packet = new nassh.sftp.Packet();
  packet.setString(handle);
  packet.setUint64(offset);
  packet.setString(data);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.WRITE, packet)
    .then(response => this.isSuccessResponse_(response, 'WRITE'));
};


/**
 * Creates a new remote directory.
 *
 * @param {string} path The path of the remote directory
 * @return {!Promise<!StatusPacket>} A Promise that resolves with the remote
 *    handle, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.makeDirectory = function(path) {
  var packet = new nassh.sftp.Packet();
  packet.setString(lib.encodeUTF8(this.basePath_ + path));
  packet.setUint32(0); // flags, 0b0000, no modified attributes

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.MKDIR, packet)
    .then(response => this.isSuccessResponse_(response, 'MKDIR'));
};


/**
 * Canonicalize a path.
 *
 * @param {string} path The path to canonicalize.
 * @return {!Promise<!StatusPacket>} A Promise that resolves with the remote
 *    path, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.realPath = function(path) {
  var packet = new nassh.sftp.Packet();
  packet.setString(lib.encodeUTF8(this.basePath_ + path));

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.REALPATH, packet)
    .then(response => this.isNameResponse_(response, 'REALPATH'));
};


/**
 * Read a symlink.
 *
 * @param {string} path The symlink to read.
 * @return {!Promise<!StatusPacket>} A Promise that resolves with the remote
 *    path, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.readLink = function(path) {
  var packet = new nassh.sftp.Packet();
  packet.setString(lib.encodeUTF8(this.basePath_ + path));

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.READLINK, packet)
    .then(response => this.isNameResponse_(response, 'READLINK'));
};


/**
 * Create a symlink.
 *
 * Note: The SFTPv3 protocol says the order should be linkpath then targetpath,
 * but we're reversed to match OpenSSH.  See ../doc/hack.md for more details.
 *
 * @param {string} target The target of the symlink.
 * @param {string} path The symlink to create.
 * @return {!Promise<!StatusPacket>} A Promise that resolves with the remote
 *    path, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.symLink = function(target, path) {
  var packet = new nassh.sftp.Packet();
  packet.setString(lib.encodeUTF8(target));
  packet.setString(lib.encodeUTF8(this.basePath_ + path));

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.SYMLINK, packet)
    .then(response => this.isSuccessResponse_(response, 'SYMLINK'));
};
