// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Relay ssh-agent messages to another app.
 *
 */
nassh.Stream.SSHAgentRelay = function(fd) {
  nassh.Stream.apply(this, [fd]);

  this.authAgentAppID_ = null;
  this.writeBuffer_ = [];
};

/**
 * We are a subclass of nassh.Stream.
 */
nassh.Stream.SSHAgentRelay.prototype = {
  __proto__: nassh.Stream.prototype
};

/**
 * Open a connection to agent.
 */
nassh.Stream.SSHAgentRelay.prototype.asyncOpen_ = function(args, onComplete) {
  this.authAgentAppID_ = args.authAgentAppID;

  var onError = function() {
    console.error('Failed to contact ' + this.authAgentAppID_);
    onComplete(false);
  }.bind(this);

  function onReady() {
    onComplete(true);
  }

  // Send a test message to agent to verify its presence.
  chrome.runtime.sendMessage(
      this.authAgentAppID_,
      {
        'type': 'auth-agent@openssh.com',
        'data': [0]
      },
      function(rsp) {
        if (chrome.runtime.lastError) {
          onError();
        } else {
          onReady();
        }
      });
};

/**
 * Convert binary byte array into base64 ascii.
 */
nassh.Stream.SSHAgentRelay.prototype.binaryToAscii = function(b) {
  function x(y) { return String.fromCharCode(y); }

  return btoa(Array.prototype.map.call(b, x).join(''));
};

/**
 * Convert ascii base64 into binary byte array.
 */
nassh.Stream.SSHAgentRelay.prototype.asciiToBinary = function(a) {
  function x(y) { return y.charCodeAt(0); }

  return Array.prototype.map.call(atob(a), x);
};

/**
 * Check whether there is enough data in the write buffer to consitute a packet.
 * If so, send packet and handle reply.
 */
nassh.Stream.SSHAgentRelay.prototype.trySendPacket_ = function() {
  // Message header, 4 bytes of length.
  if (this.writeBuffer_.length < 4) return;

  var size = ((this.writeBuffer_[0] & 255) << 24) +
             ((this.writeBuffer_[1] & 255) << 16) +
             ((this.writeBuffer_[2] & 255) << 8) +
             ((this.writeBuffer_[3] & 255) << 0);

  // Message body.
  if (this.writeBuffer_.length < 4 + size) return;

  this.writeBuffer_.splice(0, 4);  // Consume header.
  var reqData = this.writeBuffer_.splice(0, size);  // Consume body.

  var processResponse = function(rsp) {
    if (rsp.data && rsp.data.length) {
      // Prepare header.
      var size = rsp.data.length;
      var hdr = [(size >>> 24) & 255,
                 (size >>> 16) & 255,
                 (size >>> 8) & 255,
                 (size >>> 0) & 255];
      // Append body.
      var bData = hdr.concat(rsp.data);

      // Report to client.
      this.onDataAvailable(this.binaryToAscii(bData));

      // Re-examine write buffer; there might be more data in it.
      setTimeout(this.trySendPacket_.bind(this), 0);
    }
  }.bind(this);

  chrome.runtime.sendMessage(
    this.authAgentAppID_,
    {
      'type': 'auth-agent@openssh.com',
      'data': reqData
    },
    processResponse);
};

/**
 * Append data to write buffer.
 */
nassh.Stream.SSHAgentRelay.prototype.asyncWrite = function(data, onSuccess) {
  if (!data.length)
    return;

  var bData = this.asciiToBinary(data);
  this.writeBuffer_ = this.writeBuffer_.concat(bData);

  setTimeout(this.trySendPacket_.bind(this), 0);

  // Note: report binary length written.
  onSuccess(bData.length);
};

/**
 * The asyncRead method is a no-op for this class.
 *
 * Instead we push data to the client using the onDataAvailable event.
 */
nassh.Stream.SSHAgentRelay.prototype.asyncRead = function(size, onRead) {
  setTimeout(function() { onRead('') }, 0);
};
