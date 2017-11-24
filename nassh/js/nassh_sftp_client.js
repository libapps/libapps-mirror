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
  this.protoVersion = 3;

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
  this.pendingRequests = {};

  // A map of currently opened files.
  // Takes a openRequestId for a key and a file handle as a value.
  this.openedFiles = {};
};

/**
 * Stream wants to write some packet data to the client.
 */
nassh.sftp.Client.prototype.writeUTF8 = function(data) {
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
  if (packetType == nassh.sftp.packets.RequestPackets.VERSION) {
    this.pendingRequests['init']();
    return true;
  }

  // Obtain the response packet's constructor and create it.
  var ResponseType = nassh.sftp.packets.ResponsePackets[packetType]
      || nassh.sftp.UnknownPacket;
  var responsePacket = new ResponseType(packet);

  // get request id and execute the callback (if found)
  var requestId = responsePacket.requestId;
  if(this.pendingRequests.hasOwnProperty(requestId)) {
    this.pendingRequests[requestId](responsePacket);
    delete this.pendingRequests[requestId];
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
  var str = JSON.stringify({name: name, arguments: args});
  this.plugin_.postMessage(str);
};


/**
 * Sends a SFTP request and awaits the response.
 *
 * @param {number} type SFTP packet type of outgoing request
 * @param {!nassh.sftp.Packet} data The body of the request (not including
 *    length, type and requestId)
 * @return {!Promise} A Promise that resolves with the response packet
 */
nassh.sftp.Client.prototype.sendRequest_ = function(type, data) {
  if (!this.isInitialised) {
    throw new Error('Tried sending a SFTP request before the connection had'
                    + ' been initialized.');
  }

  var requestId = this.requestId_++;
  var packet = new nassh.sftp.Packet();
  packet.setUint32(data.getLength() + 5);
  packet.setUint8(type);
  packet.setUint32(requestId);
  packet.setData(data);

  return new Promise(resolve => {
    this.pendingRequests[requestId] = resolve;
    this.sendToPlugin_('onRead', [0, btoa(packet.toString())]);
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
  packet.setUint32(this.protoVersion);

  this.pendingRequests['init'] = () => {
    console.log('init: SFTP');
    this.isInitialised = true;
  };
  this.sendToPlugin_('onRead', [0, btoa(packet.toString())]);
};


/**
 * Retrieves status information for a remote file.
 *
 * @param {string} path The path of the remote file
 * @return {!Promise<!AttrsPacket>} A Promise that resolves with the remote
 *    file attributes, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.fileStatus = function(path) {
  var packet = new nassh.sftp.Packet();
  packet.setString(this.basePath_ + path);

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
  packet.setString(this.basePath_ + path);

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
  packet.setString(this.basePath_ + path);
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
  packet.setString(this.basePath_ + path);

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
 * Removes a remote directory.
 *
 * @param {string} path The path of the remote directory
 * @return {!Promise<!StatusPacket>} A Promise that resolves or rejects with
 *    a nassh.sftp.StatusError.
 */
nassh.sftp.Client.prototype.removeDirectory = function(path) {
  var packet = new nassh.sftp.Packet();
  packet.setString(this.basePath_ + path);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.RMDIR, packet)
    .then(response => this.isSuccessResponse_(response, 'RMDIR'));
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
  packet.setString(this.basePath_ + path);
  packet.setUint32(pflags); // open flags
  packet.setUint32(0); // default attr values

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.OPEN, packet)
    .then(response => this.isExpectedResponse_(response, nassh.sftp.packets.HandlePacket, 'OPEN'))
    .then(response => response.handle);
};


/**
 * Reads a remote file.
 *
 * @param {string} handle The handle of the remote file
 * @param {number} offset The offset to start reading from
 * @param {number} len The maximum number of bytes to read
 * @return {!Promise<!DataPacket>} A Promise that resolves with the remote
 *    file data, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.readFile = function(handle, offset, len) {
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
 * Removes a remote file.
 *
 * @param {string} handle The handle of the remote file
 * @return {!Promise<!StatusPacket>} A Promise that resolves or rejects with
 *    a nassh.sftp.StatusError
 */
nassh.sftp.Client.prototype.removeFile = function(path) {
  var packet = new nassh.sftp.Packet();
  packet.setString(this.basePath_ + path);

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
  packet.setString(this.basePath_ + sourcePath);
  packet.setString(this.basePath_ + targetPath);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.RENAME, packet)
    .then(response => this.isSuccessResponse_(response, 'RENAME'));
};


/**
 * Writes to a remote file.
 *
 * @param {string} handle The handle of the remote file
 * @param {number} offset The offset to start writing from
 * @param {string} data The data to write
 * @return {!Promise<!StatusPacket>} A Promise that resolves or rejects with
 *    a nassh.sftp.StatusError
 */
nassh.sftp.Client.prototype.writeFile = function(handle, offset, data) {
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
  packet.setString(this.basePath_ + path);
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
  packet.setString(this.basePath_ + path);

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
  packet.setString(this.basePath_ + path);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.READLINK, packet)
    .then(response => this.isNameResponse_(response, 'READLINK'));
};


/**
 * Create a symlink.
 *
 * @param {string} target The target of the symlink.
 * @param {string} path The symlink to create.
 * @return {!Promise<!StatusPacket>} A Promise that resolves with the remote
 *    path, or rejects (usually with an nassh.sftp.StatusError)
 */
nassh.sftp.Client.prototype.symLink = function(target, path) {
  var packet = new nassh.sftp.Packet();
  packet.setString(target);
  packet.setString(this.basePath_ + path);

  return this.sendRequest_(nassh.sftp.packets.RequestPackets.SYMLINK, packet)
    .then(response => this.isSuccessResponse_(response, 'SYMLINK'));
};
