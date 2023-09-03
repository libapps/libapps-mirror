// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../../libdot/index.js';

import {newBuffer} from './nassh_buffer.js';
import {Packet} from './nassh_sftp_packet.js';
import {
  AttrsPacket, DataPacket, DiskFreePacket, ExtendedReplyPacket, File, FileAttrs,
  FileHandle, HandlePacket, LimitsPacket, NamePacket, OpenFlags, RequestPackets,
  ResponsePackets, setFileAttrs, StatusCodes, StatusPacket, UnknownPacket,
} from './nassh_sftp_packet_types.js';
import {StatusError} from './nassh_sftp_status.js';

/**
 * A SFTP Client that manages the sending and receiving of SFTP packets.
 *
 * @param {string=} basePath The base directory for client requests.
 * @constructor
 */
export function Client(basePath = '') {
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
  this.buffer_ = newBuffer(/* autoack= */ true);

  // A map of pending packet requests.
  // Takes a requestId for a key and a Promise as a value.
  this.pendingRequests_ = {};

  // A map of currently opened files.
  // Takes a openRequestId for a key and a file handle as a value.
  this.openedFiles = {};
}

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
Client.prototype.protocolChunkSize = 32 * 1024;

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
Client.prototype.readChunkSize = Client.prototype.protocolChunkSize;

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
Client.prototype.writeChunkSize = Client.prototype.protocolChunkSize;

/**
 * Stream wants to write some packet data to the client.
 *
 * @param {!ArrayBuffer} data
 */
Client.prototype.writeStreamData = function(data) {
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
Client.prototype.parseBuffer_ = function() {
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
  const packet = new Packet(data);

  // onPacket handler will return true if valid, else false.
  return this.onPacket(packet);
};

/**
 * onPacket handler. Will read the response packet's type and find the
 * requesting packet's callback. If the response packet is valid and has a valid
 * request id, it will be returned with the callback. Finding and executing
 * a callback will return true, else will return false if an error occurred.
 *
 * @param {!Packet} packet
 * @return {boolean}
 */
Client.prototype.onPacket = function(packet) {
  const packetType = packet.getUint8();

  // Obtain the response packet's constructor and create it.
  const ResponseType = ResponsePackets[packetType] || UnknownPacket;
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
 * @param {!Object} plugin
 * @return {!Promise<void>} Resolves when connection is ready to use.
 */
Client.prototype.initConnection = async function(plugin) {
  this.plugin_ = plugin;
  return this.init();
};

/**
 * Sends a SFTP request and awaits the response.
 *
 * @param {number|string} type SFTP packet type of outgoing request.
 * @param {!Packet} data The body of the request (not including length, type
 *    and requestId).
 * @return {!Promise<!Packet>} A Promise that resolves with the response packet.
 */
Client.prototype.sendRequest_ = function(type, data) {
  if (!this.isInitialised) {
    throw new Error('Tried sending a SFTP request before the connection had'
                    + ' been initialized.');
  }

  // First construct the packet type portion of the packet header.
  const requestId = this.requestId_++;
  const packetType = new Packet();
  if (typeof type == 'string') {
    // Handle extended packets.
    packetType.setUint8(RequestPackets.EXTENDED);
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
  const packet = new Packet(length + 4);
  packet.setUint32(length);
  packet.setData(packetType.toByteArray());
  packet.setData(data.toByteArray());

  return new Promise((resolve) => {
    this.pendingRequests_[requestId] = resolve;
    this.plugin_.writeTo(0, packet.toArrayBuffer());
  });
};

/**
 * Checks to see whether the response packet is of the expected type or not.
 *
 * @param {!Packet} responsePacket
 * @param {function(new:Packet, !Packet)} expectedPacketType Type of expected
 *     packet.
 * @param {string} requestType
 * @return {!Packet}
 */
Client.prototype.isExpectedResponse_ = function(
    responsePacket, expectedPacketType, requestType) {
  if (responsePacket instanceof StatusPacket) {
    throw new StatusError(responsePacket, requestType);
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
 * @param {!Packet} responsePacket
 * @param {string} requestType
 * @return {!Packet}
 */
Client.prototype.isSuccessResponse_ = function(responsePacket, requestType) {
  if (!(responsePacket instanceof StatusPacket)) {
        throw new TypeError('Received unexpected response to '
                            + requestType + ' packet: ' + responsePacket);
  }

  if (responsePacket.code != StatusCodes.OK) {
    throw new StatusError(responsePacket, requestType);
  }

  return responsePacket;
};

/**
 * Checks to see whether the response packet was a name packet.
 *
 * @param {!Packet} responsePacket
 * @param {string} requestType
 * @return {!Packet}
 */
Client.prototype.isNameResponse_ = function(responsePacket, requestType) {
  if (responsePacket instanceof StatusPacket) {
    if (responsePacket.code != StatusCodes.EOF) {
      throw new StatusError(responsePacket, requestType);
    }

    // EOF
    return responsePacket;
  }

  if (!(responsePacket instanceof NamePacket)) {
    throw new TypeError('Received unexpected response to '
                        + requestType + ' packet: ' + responsePacket);
  }

  return responsePacket;
};

/**
 * Sends a SFTP init packet.
 *
 * @return {!Promise<void>} Resolves when initialization is finished.
 */
Client.prototype.init = async function() {
  const packet = new Packet();
  packet.setUint32(5); // length, 5 bytes for type and version fields
  packet.setUint8(RequestPackets.INIT);
  packet.setUint32(this.protocolClientVersion);

  // Get through the initial init handshake.
  await new Promise((resolve, reject) => {
    this.pendingRequests_['init'] = (packet) => {
      console.log('init: SFTP');
      this.protocolServerVersion = packet.version;
      this.protocolServerExtensions = packet.extensions;

      // Make sure the version matches what we support.
      if (this.protocolServerVersion != this.protocolClientVersion) {
        reject(`SFTPv${this.protocolServerVersion} not supported`);
        return;
      }

      this.isInitialised = true;

      resolve();
    };

    this.plugin_.writeTo(0, packet.toArrayBuffer());
  });

  // See the comments for these class constants for details.
  const limits = await this.queryLimits();
  if (limits.maxReadLength) {
    this.readChunkSize = limits.maxReadLength;
  }
  if (limits.maxWriteLength) {
    this.writeChunkSize = limits.maxWriteLength;
  }
};

/**
 * Retrieves status information for a remote file.
 *
 * @param {string} path The path of the remote file
 * @return {!Promise<!FileAttrs>} A Promise that resolves with the remote file
 *     attributes, or rejects (usually with a StatusError).
 */
Client.prototype.fileStatus = function(path) {
  const packet = new Packet();
  packet.setUtf8String(this.basePath_ + path);

  return this.sendRequest_(RequestPackets.STAT, packet)
      .then((response) => {
        return this.isExpectedResponse_(response, AttrsPacket, 'STAT');
      })
      .then((response) => response.attrs);
};

/**
 * Retrieves status information for a remote symlink.
 *
 * @param {string} path The path of the remote symlink
 * @return {!Promise<!FileAttrs>} A Promise that resolves with the remote file
 *     attributes, or rejects (usually with a StatusError).
 */
Client.prototype.linkStatus = function(path) {
  const packet = new Packet();
  packet.setUtf8String(this.basePath_ + path);

  return this.sendRequest_(RequestPackets.LSTAT, packet)
      .then((response) => {
        return this.isExpectedResponse_(response, AttrsPacket, 'LSTAT');
      })
      .then((response) => response.attrs);
};

/**
 * Retrieves status information for a remote file handle.
 *
 * @param {string} handle The open file handle
 * @return {!Promise<!FileAttrs>} A Promise that resolves with the remote file
 *     attributes, or rejects (usually with a StatusError).
 */
Client.prototype.fileHandleStatus = function(handle) {
  const packet = new Packet();
  packet.setString(handle);

  return this.sendRequest_(RequestPackets.FSTAT, packet)
      .then((response) => {
        return this.isExpectedResponse_(response, AttrsPacket, 'FSTAT');
      })
      .then((response) => response.attrs);
};

/**
 * Sets status information for a remote file.
 *
 * @param {string} path The path of the remote file
 * @param {!FileAttrs} attrs The file attributes to set (see the
 *     structure getFileAttrs sets up).
 * @return {!Promise<!AttrsPacket>} A Promise that resolves with the remote file
 *     attributes, or rejects (usually with a StatusError).
 */
Client.prototype.setFileStatus = function(path, attrs) {
  const packet = new Packet();
  packet.setUtf8String(this.basePath_ + path);
  setFileAttrs(packet, attrs);

  return this.sendRequest_(RequestPackets.SETSTAT, packet)
    .then((response) => this.isSuccessResponse_(response, 'SETSTAT'));
};

/**
 * Sets status information for a remote file handle.
 *
 * @param {string} handle The open file handle
 * @param {!FileAttrs} attrs The file attributes to set (see the
 *     structure getFileAttrs sets up).
 * @return {!Promise<!AttrsPacket>} A Promise that resolves with the remote file
 *     attributes, or rejects (usually with a StatusError).
 */
Client.prototype.setFileHandleStatus = function(handle, attrs) {
  const packet = new Packet();
  packet.setString(handle);
  setFileAttrs(packet, attrs);

  return this.sendRequest_(RequestPackets.FSETSTAT, packet)
    .then((response) => this.isSuccessResponse_(response, 'FSETSTAT'));
};

/**
 * Opens a remote directory.
 *
 * @param {string} path The path of the remote directory
 * @return {!Promise<string>} A Promise that resolves with the remote
 *    directory handle, or rejects (usually with a StatusError)
 */
Client.prototype.openDirectory = function(path) {
  const packet = new Packet();
  packet.setUtf8String(this.basePath_ + path);

  return this.sendRequest_(RequestPackets.OPENDIR, packet)
      .then((response) => {
        return this.isExpectedResponse_(response, HandlePacket, 'OPENDIR');
      })
      .then((response) => response.handle);
};

/**
 * Reads the contents of a remote directory.
 *
 * @param {string} handle The handle of the remote directory
 * @return {!Promise<!NamePacket>} A Promise that resolves with the remote
 *     directory contents, or rejects (usually with a StatusError).
 */
Client.prototype.readDirectory = function(handle) {
  const packet = new Packet();
  packet.setString(handle);

  return this.sendRequest_(RequestPackets.READDIR, packet)
    .then((response) => this.isNameResponse_(response, 'READDIR'));
};

/**
 * List all the entries of a directory.
 *
 * This is a helper function to enumerate an entire directory with optional
 * filtering on each result.
 *
 * @param {string} handle The handle of the remote directory.
 * @param {function((!File|!FileAttrs))=} filter A callback function
 *     to filter results. The return value controls behavior: false will skip
 *     the entry, true will keep the entry, undefined will abort processing, a
 *     Promise will resolve (and its return will replace the entry if not
 *     falsy), and all other return values will replace the entry.
 * @return {!Promise<!Array<(!File|!FileAttrs)>>} A list of all the entries in
 *     this directory.
 */
Client.prototype.scanDirectory = function(handle, filter) {
  let entries = [];

  const nextRead = () => {
    return this.readDirectory(handle)
      .then((response) => {
        // If EOF, return all the directory entries.
        if (response instanceof StatusPacket &&
            response.code == StatusCodes.EOF) {
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
 * @return {!Promise<!StatusPacket>} A Promise that resolves or rejects with a
 *     StatusError.
 */
Client.prototype.removeDirectory = function(path, recursive = false) {
  // Low level directory remove packet.  Only works if the dir is already empty.
  const rmdir = (path) => {
    const packet = new Packet();
    packet.setUtf8String(this.basePath_ + path);

    return this.sendRequest_(RequestPackets.RMDIR, packet)
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
 * @return {!Promise<!FileHandle>} A Promise that resolves with the remote file
 *     handle, or rejects (usually with a StatusError).
 */
Client.prototype.openFile = function(path, pflags) {
  const packet = new Packet();
  packet.setUtf8String(this.basePath_ + path);
  packet.setUint32(pflags); // open flags
  packet.setUint32(0); // default attr values

  return this.sendRequest_(RequestPackets.OPEN, packet)
      .then((response) => {
        return this.isExpectedResponse_(response, HandlePacket, 'OPEN');
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
 *    file data, or rejects (usually with a StatusError)
 */
Client.prototype.readChunk = function(handle, offset, len) {
  const packet = new Packet();
  packet.setString(handle);
  packet.setUint64(offset); // offset
  packet.setUint32(len); // max bytes per packet

  return this.sendRequest_(RequestPackets.READ, packet)
    .then((response) => {
      if (response instanceof StatusPacket) {
        if (response.code != StatusCodes.EOF) {
          throw new StatusError(response, 'READ');
        }
        return ''; // EOF, return empty data string
      }

      if (!(response instanceof DataPacket)) {
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
Client.prototype.readChunks = function(
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
  const processChunk = async (chunk) => {
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
    if (await callback(chunk) === false) {
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
Client.prototype.readFile = function(
    path, callback, offset = 0, length = undefined) {
  return this.openFile(path, OpenFlags.READ)
    .then((handle) => {
      return this.readChunks(handle, callback, offset, length)
        .finally(() => this.closeFile(handle));
    });
};

/**
 * Closes a remote file handle.
 *
 * @param {string} handle The handle of the remote file
 * @return {!Promise<!StatusPacket>} A Promise that resolves or rejects with a
 *     StatusError.
 */
Client.prototype.closeFile = function(handle) {
  const packet = new Packet();
  packet.setString(handle);

  return this.sendRequest_(RequestPackets.CLOSE, packet)
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
 * @return {!Promise<!StatusPacket>} A Promise that resolves or rejects with a
 *     StatusError.
 */
Client.prototype.copyData = function(
    readHandle, writeHandle, length = 0, readOffset = 0, writeOffset = 0) {
  const packet = new Packet();
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
 * @return {!Promise<!StatusPacket>} A Promise that resolves or rejects with a
 *     StatusError.
 */
Client.prototype.removeFile = function(path) {
  const packet = new Packet();
  packet.setUtf8String(this.basePath_ + path);

  return this.sendRequest_(RequestPackets.REMOVE, packet)
    .then((response) => this.isSuccessResponse_(response, 'REMOVE'));
};

/**
 * Retrieves server limits for the connection.
 *
 * @return {!Promise<!LimitsPacket>} A Promise that resolves with the server
 *     limits, or rejects (usually with a StatusError).
 */
Client.prototype.queryLimits = function() {
  if (this.protocolServerExtensions['limits@openssh.com'] !== '1') {
    // If the extension is not supported, try and guess if it's OpenSSH.  We
    // probably want to drop this one day (like when OpenSSH 8.5 from Mar 2021
    // is widely deployed).  Let's say keep it until Mar 2025?
    if (this.protocolServerExtensions['fstatvfs@openssh.com'] == '2') {
      // See if the server is OpenSSH.  Checking for this particular protocol
      // extension isn't an exact match, but should be good enough for now.
      return Promise.resolve(/** @type {!LimitsPacket} */ ({
        maxReadLength: 64 * 1024,
        maxWriteLength: 255 * 1024,
      }));
    }

    // The caller can figure it out.
    return Promise.resolve(/** @type {!LimitsPacket} */ ({}));
  }

  const packet = new Packet();
  return this.sendRequest_('limits@openssh.com', packet)
    .then((response) => {
      return this.isExpectedResponse_(response, ExtendedReplyPacket, 'LIMITS');
    })
    .then((response) => new LimitsPacket(response));
};

/**
 * Renames the path name of a remote file.
 *
 * @param {string} sourcePath The source path of the remote file
 * @param {string} targetPath The target path of the remote file
 * @return {!Promise<!StatusPacket>} A Promise that resolves or rejects with a
 *     StatusError.
 */
Client.prototype.renameFile = function(sourcePath, targetPath) {
  const packet = new Packet();

  let type;
  if (this.protocolServerExtensions['posix-rename@openssh.com'] == '1') {
    type = 'posix-rename@openssh.com';
  } else {
    type = RequestPackets.RENAME;
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
 * @return {!Promise<!StatusPacket>} A Promise that resolves or rejects with a
 *     StatusError.
 */
Client.prototype.writeChunk = function(handle, offset, data) {
  // Accept any typed array form.
  data = new Uint8Array(data);

  const packet = new Packet();
  packet.setString(handle);
  packet.setUint64(offset);
  packet.setUint32(data.length);
  packet.setData(data);

  return this.sendRequest_(RequestPackets.WRITE, packet)
    .then((response) => this.isSuccessResponse_(response, 'WRITE'));
};

/**
 * Creates a new remote directory.
 *
 * @param {string} path The path of the remote directory
 * @return {!Promise<!StatusPacket>} A Promise that resolves with the remote
 *     handle, or rejects (usually with a StatusError).
 */
Client.prototype.makeDirectory = function(path) {
  const packet = new Packet();
  packet.setUtf8String(this.basePath_ + path);
  packet.setUint32(0); // flags, 0b0000, no modified attributes

  return this.sendRequest_(RequestPackets.MKDIR, packet)
    .then((response) => this.isSuccessResponse_(response, 'MKDIR'));
};

/**
 * Canonicalize a path.
 *
 * @param {string} path The path to canonicalize.
 * @return {!Promise<!NamePacket>} A Promise that resolves with the remote path,
 *     or rejects (usually with a StatusError).
 */
Client.prototype.realPath = function(path) {
  const packet = new Packet();
  packet.setUtf8String(this.basePath_ + path);

  return this.sendRequest_(RequestPackets.REALPATH, packet)
    .then((response) => this.isNameResponse_(response, 'REALPATH'));
};

/**
 * Read a symlink.
 *
 * @param {string} path The symlink to read.
 * @return {!Promise<!NamePacket>} A Promise that resolves with the remote path,
 *     or rejects (usually with a StatusError).
 */
Client.prototype.readLink = function(path) {
  const packet = new Packet();
  packet.setUtf8String(this.basePath_ + path);

  return this.sendRequest_(RequestPackets.READLINK, packet)
    .then((response) => this.isNameResponse_(response, 'READLINK'));
};

/**
 * Create a symlink.
 *
 * Note: The SFTPv3 protocol says the order should be linkpath then targetpath,
 * but we're reversed to match OpenSSH.  See ../docs/hack.md for more details.
 *
 * @param {string} target The target of the symlink.
 * @param {string} path The symlink to create.
 * @return {!Promise<!StatusPacket>} A Promise that resolves with the remote
 *     path, or rejects (usually with a StatusError).
 */
Client.prototype.symLink = function(target, path) {
  const packet = new Packet();
  packet.setUtf8String(target);
  packet.setUtf8String(this.basePath_ + path);

  return this.sendRequest_(RequestPackets.SYMLINK, packet)
    .then((response) => this.isSuccessResponse_(response, 'SYMLINK'));
};

/**
 * Create a hardlink.
 *
 * This requires the hardlink@openssh.com extension.
 *
 * @param {string} oldpath The existing path to link to.
 * @param {string} newpath The new path to create.
 * @return {!Promise<!StatusPacket>} A Promise that resolves or rejects with a
 *     StatusError.
 */
Client.prototype.hardLink = function(oldpath, newpath) {
  if (this.protocolServerExtensions['hardlink@openssh.com'] != '1') {
    throw new StatusError({
      'code': StatusCodes.OP_UNSUPPORTED,
      'message': 'hardlink@openssh.com not supported',
    }, 'HARDLINK');
  }

  const packet = new Packet();
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
 * @return {!Promise<!DiskFreePacket>} A Promise that resolves or rejects with a
 *     StatusError.
 */
Client.prototype.statvfs = function(path) {
  if (this.protocolServerExtensions['statvfs@openssh.com'] != '2') {
    throw new StatusError({
      'code': StatusCodes.OP_UNSUPPORTED,
      'message': 'statvfs@openssh.com not supported',
    }, 'STATVFS');
  }

  const packet = new Packet();
  packet.setUtf8String(this.basePath_ + path);

  return this.sendRequest_('statvfs@openssh.com', packet)
    .then((response) => {
      return this.isExpectedResponse_(response, ExtendedReplyPacket, 'STATVFS');
    })
    .then((response) => new DiskFreePacket(response));
};

/**
 * Sync the open handle.
 *
 * This requires the fsync@openssh.com extension.
 *
 * @param {string} handle The handle of the remote file.
 * @return {!Promise<!StatusPacket>} A Promise that resolves or rejects with a
 *     StatusError.
 */
Client.prototype.fsync = function(handle) {
  if (this.protocolServerExtensions['fsync@openssh.com'] != '1') {
    throw new StatusError({
      'code': StatusCodes.OP_UNSUPPORTED,
      'message': 'fsync@openssh.com not supported',
    }, 'FSYNC');
  }

  const packet = new Packet();
  packet.setString(handle);

  return this.sendRequest_('fsync@openssh.com', packet)
    .then((response) => this.isSuccessResponse_(response, 'FSYNC'));
};
