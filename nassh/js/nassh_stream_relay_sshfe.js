// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Stream for connecting to a ssh server via a SSH-FE relay.
 */

/**
 * WebSocket backed stream.
 *
 * This class manages the read and write through WebSocket to communicate
 * with the SSH-FE relay server.
 *
 * Resuming of connections is not supported.
 *
 * @param {number} fd
 */
nassh.Stream.RelaySshfeWS = function(fd) {
  nassh.Stream.call(this, fd);

  // The relay connection settings.
  this.io_ = null;
  this.relayHost_ = null;
  this.relayPort_ = null;
  this.relayUser_ = null;

  // The remote ssh server settings.
  this.host_ = null;
  this.port_ = null;

  // The ssh-agent we talk to for the SSH-FE challenge.
  this.sshAgent_ = null;

  // All the data we've queued but not yet sent out.
  this.writeBuffer_ = new Uint8Array();
  // Callback function when asyncWrite is used.
  this.onWriteSuccess_ = null;

  // Data we've read so we can ack it to the server.
  this.readCount_ = 0;

  // The actual WebSocket connected to the ssh server.
  this.socket_ = null;
};

/**
 * We are a subclass of nassh.Stream.
 */
nassh.Stream.RelaySshfeWS.prototype = Object.create(nassh.Stream.prototype);
nassh.Stream.RelaySshfeWS.constructor = nassh.Stream.RelaySshfeWS;

/**
 * Open a relay socket.
 *
 * @param {Object} args
 * @param {function(bool, string=)} onComplete
 */
nassh.Stream.RelaySshfeWS.prototype.asyncOpen_ = function(args, onComplete) {
  this.io_ = args.io;
  this.relayHost_ = args.relayHost;
  this.relayPort_ = args.relayPort;
  this.relayUser_ = args.relayUser;
  this.host_ = args.host;
  this.port_ = args.port;
  this.sshAgent_ = args.sshAgent;

  // The SSH-FE challenge details.
  let sshFeChallenge = null;
  let sshFeSignature = null;

  this.getChallenge_()
    .then((challenge) => {
      sshFeChallenge = challenge;
      return this.signChallenge_(challenge);
    })
    .then((signature) => {
      sshFeSignature = nassh.base64ToBase64Url(signature);
      this.connect_(sshFeChallenge, sshFeSignature);
      onComplete(true);
    })
    .catch((e) => onComplete(false, `${e.message}\r\n${lib.f.getStack()}`));
};

/**
 * URI to get a new challenge for connecting through the relay.
 */
nassh.Stream.RelaySshfeWS.prototype.challengeTemplate_ =
    `%(protocol)://%(relayHost):%(relayPort)` +
    `/challenge?user=%encodeURIComponent(relayUser)`;

/**
 * Get the server challenge.
 *
 * @return {Promise} A promise to resolve with the server's challenge.
 */
nassh.Stream.RelaySshfeWS.prototype.getChallenge_ = function() {
  // Send the current user to the relay to get the challenge.
  const uri = lib.f.replaceVars(this.challengeTemplate_, {
    protocol: 'https',
    relayHost: this.relayHost_,
    relayPort: this.relayPort_,
    relayUser: this.relayUser_,
  });

  const req = new Request(uri);
  return fetch(req)
    .then((response) => {
      // Make sure the server didn't return a failure.
      if (!response.ok) {
        throw new Error(response.statusText);
      }

      // Get the response from the server as a blob.
      return response.blob();
    })
    .then((blob) => {
      const reader = new lib.fs.FileReader();
      return reader.readAsText(blob);
    })
    .then((result) => {
      // Skip the XSSI countermeasure.
      if (!result.startsWith(")]}'\n")) {
        throw Error(`Unknown response: ${result}`);
      }

      // Pull out the challenge from the response.
      const obj = JSON.parse(result.slice(5));
      return obj.challenge;
    });
};

/**
 * Send a message to the ssh agent.
 *
 * @param {Object} data The object to send to the agent.
 * @return {Promise} A promise to resolve with the agent's response.
 */
nassh.Stream.RelaySshfeWS.prototype.sendAgentMessage_ = function(data) {
  // The Chrome message API uses callbacks, so wrap in a Promise ourselves.
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
        this.sshAgent_,
        {'type': 'auth-agent@openssh.com', 'data': data},
        resolve);
  });
};

/**
 * Sign the server's challenge with a ssh key via a ssh agent.
 *
 * TODO: This uses gnubby-specific messages currently (113 & 114) to locate the
 * specific key to use to sign the challenge.
 *
 * @param {string} challenge The server challenge
 * @return {Promise} A promise to resolve with the signed result.
 */
nassh.Stream.RelaySshfeWS.prototype.signChallenge_ = function(challenge) {
  // Construct a SSH_AGENTC_PUBLIC_KEY_CHALLENGE packet.
  //   byte    code
  //   byte    slot
  //   byte    alt
  // TODO: Rename "challenge" since it has nothing to do with |challenge| parameter.
  //   string  challenge  (16 bytes)
  const buffer = new ArrayBuffer(23);
  const u8 = new Uint8Array(buffer);
  const dv = new DataView(buffer);
  // message code: SSH_AGENTC_PUBLIC_KEY_CHALLENGE.
  dv.setUint8(0, 113);
  // public key slot: Where we store the key to use.
  // TODO: Users should be able to select this.
  dv.setUint8(1, 5);
  // alternate: Set to false.
  dv.setUint8(2, 0);
  // The challenge length.
  dv.setUint32(3, 16);
  // The random challenge itself.
  crypto.getRandomValues(u8.subarray(7, 16));

  // Send the challenge.
  return this.sendAgentMessage_(Array.from(u8)).then((result) => {
    if (result.data.length <= 5) {
      throw new Error(`Agent failed; missing ssh certificate? (${result.data})`);
    }

    // Receive SSH_AGENTC_PUBLIC_KEY_RESPONSE.
    const response = nassh.agent.messages.read(
        new nassh.agent.Message(result.data[0], result.data.slice(1)));

    // Construct a SSH_AGENTC_SIGN_REQUEST.
    const request = nassh.agent.messages.write(
        nassh.agent.messages.Numbers.AGENTC_SIGN_REQUEST,
        new Uint8Array(response.fields.publicKeyRaw),
        lib.codec.stringToCodeUnitArray(challenge, Uint8Array));

    // Send the sign request.  We can only send Arrays, but request is a typed
    // array, so convert it over (and skip leading length field).
    const data = Array.from(request.rawMessage().subarray(4));
    return this.sendAgentMessage_(data).then((result) => {
      if (result.data.length <= 5) {
        throw new Error(`Agent failed; unable to sign challenge (${result.data})`);
      }

      // Return the signed challenge.
      return btoa(lib.codec.codeUnitArrayToString(result.data.slice(5)));
    });
  });
};

/**
 * Maximum length of message that can be sent to avoid request limits.
 */
nassh.Stream.RelaySshfeWS.prototype.maxMessageLength = 64 * 1024;

/**
 * URI to establish a connection to the ssh server via the relay.
 *
 * Note: The user field here isn't really needed.  We pass it along to help
 * with remote logging on the server.
 */
nassh.Stream.RelaySshfeWS.prototype.connectTemplate_ =
    `%(protocol)://%(relayHost):%(relayPort)/connect` +
    `?ssh-fe-challenge=%encodeURIComponent(challenge)` +
    `&ssh-fe-signature=%encodeURIComponent(signature)` +
    `&host=%encodeURIComponent(host)` +
    `&port=%encodeURIComponent(port)` +
    `&user=%encodeURIComponent(relayUser)` +
    `&ack=%(readCount)` +
    `&pos=%(writeCount)`;

/**
 * Start a new connection to the proxy server.
 */
nassh.Stream.RelaySshfeWS.prototype.connect_ = function(challenge, signature) {
  if (this.socket_) {
    throw new Error('stream already connected');
  }

  const uri = lib.f.replaceVars(this.connectTemplate_, {
    protocol: 'wss',
    relayHost: this.relayHost_,
    relayPort: this.relayPort_,
    relayUser: this.relayUser_,
    challenge: challenge,
    signature: signature,
    host: this.host_,
    port: this.port_,
    readCount: this.readCount_,
    writeCount: 0,
  });

  this.socket_ = new WebSocket(uri);
  this.socket_.binaryType = 'arraybuffer';
  this.socket_.onopen = this.onSocketOpen_.bind(this);
  this.socket_.onmessage = this.onSocketData_.bind(this);
  this.socket_.onclose = this.onSocketClose_.bind(this);
  this.socket_.onerror = this.onSocketError_.bind(this);
};

/**
 * Close the connection to the proxy server and clean up.
 *
 * @param {string} reason A short message explaining the reason for closing.
 */
nassh.Stream.RelaySshfeWS.prototype.close_ = function(reason) {
  // If we aren't open, there's nothing to do.  This allows us to call it
  // multiple times, perhaps from cascading events (write error/close/etc...).
  if (!this.socket_) {
    return;
  }

  console.log(`Closing socket due to ${reason}`);
  this.socket_.close();
  this.socket_ = null;
  nassh.Stream.prototype.close.call(this);
};

/**
 * Callback when the socket connects successfully.
 *
 * @param {Event} e The event details.
 */
nassh.Stream.RelaySshfeWS.prototype.onSocketOpen_ = function(e) {
  // If we had any pending writes, kick them off.  We can't call sendWrite
  // directly as the socket isn't in the correct state until after this handler
  // finishes executing.
  setTimeout(this.sendWrite_.bind(this), 0);
};

/**
 * Callback when the socket closes when the connection is finished.
 *
 * @param {CloseEvent} e The event details.
 */
nassh.Stream.RelaySshfeWS.prototype.onSocketClose_ = function(e) {
  this.close_('server closed socket');
};

/**
 * Callback when the socket closes due to an error.
 *
 * @param {Event} e The event details.
 */
nassh.Stream.RelaySshfeWS.prototype.onSocketError_ = function(e) {
  this.close_('server sent an error');
};

/**
 * Callback when new data is available from the server.
 *
 * @param {MessageEvent} e The message with data to read.
 */
nassh.Stream.RelaySshfeWS.prototype.onSocketData_ = function(e) {
  const dv = new DataView(e.data);
  const ack = dv.getUint32(0);

  // Acks are unsigned 24 bits.  Negative means error.
  if (ack > 0xffffff) {
    this.close_(`ack ${ack} is an error`);
    return;
  }

  // This creates a copy of the ArrayBuffer, but there doesn't seem to be an
  // alternative -- PPAPI doesn't accept views like Uint8Array.  And if it did,
  // it would probably still serialize the entire underlying ArrayBuffer (which
  // in this case wouldn't be a big deal as it's only 4 extra bytes).
  const data = e.data.slice(4);
  this.readCount_ = (this.readCount_ + data.byteLength) & 0xffffff;
  this.onDataAvailable(data);
};

/**
 * Queue up some data to write asynchronously.
 *
 * @param {string} data A base64 encoded string.
 * @param {function(number)=} onSuccess Optional callback.
 */
nassh.Stream.RelaySshfeWS.prototype.asyncWrite = function(data, onSuccess) {
  if (!data.byteLength) {
    return;
  }

  this.writeBuffer_ = lib.array.concatTyped(
      this.writeBuffer_, new Uint8Array(data));
  this.onWriteSuccess_ = onSuccess;
  this.sendWrite_();
};

/**
 * Send out any queued data.
 */
nassh.Stream.RelaySshfeWS.prototype.sendWrite_ = function() {
  if (!this.socket_ || this.socket_.readyState != 1 ||
      this.writeBuffer_.length == 0) {
    // Nothing to write or socket is not ready.
    return;
  }

  const readBuffer = this.writeBuffer_.subarray(0, this.maxMessageLength);
  const size = readBuffer.length;
  const buf = new ArrayBuffer(size + 4);
  const u8 = new Uint8Array(buf, 4);
  const dv = new DataView(buf);

  dv.setUint32(0, this.readCount_);

  // Copy over the read buffer.
  u8.set(readBuffer);

  this.socket_.send(buf);
  this.writeBuffer_ = this.writeBuffer_.subarray(size);

  if (this.onWriteSuccess_ !== null) {
    // Notify nassh that we are ready to consume more data.
    this.onWriteSuccess_(size);
  }

  if (this.writeBuffer_.length) {
    // We have more data to send but due to message limit we didn't send it.
    setTimeout(this.sendWrite_.bind(this), 0);
  }
};
