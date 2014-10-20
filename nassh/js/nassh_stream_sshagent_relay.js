// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Relay ssh-agent messages to another app.
 *
 */
nassh.Stream.SSHAgentRelay = function(fd) {
  nassh.Stream.apply(this, [fd]);

  this.authAgentAppID_ = null;
  this.port_ = null;
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
  this.port_ = chrome.runtime.connect(this.authAgentAppID_);

  var normalOnMessage = function(msg) {
    if (msg.data) {
      // Prepare header.
      var size = msg.data.length;
      var hdr = [(size >>> 24) & 255,
                 (size >>> 16) & 255,
                 (size >>> 8) & 255,
                 (size >>> 0) & 255];
      // Append body.
      var bData = hdr.concat(msg.data);

      // Report to client.
      this.onDataAvailable(this.binaryToAscii(bData));

      // Re-examine write buffer; there might be more data in it.
      setTimeout(this.trySendPacket_.bind(this), 0);
    }
  }.bind(this);

  var normalDisconnect = function() {
    this.port_.onMessage.removeListener(normalOnMessage);
    this.port_.onDisconnect.removeListener(normalDisconnect);
    this.close();
  }.bind(this);

  var initialOnMessage = function(msg) {
    this.port_.onMessage.removeListener(initialOnMessage);
    this.port_.onDisconnect.removeListener(initialDisconnect);
    this.port_.onMessage.addListener(normalOnMessage);
    this.port_.onDisconnect.addListener(normalDisconnect);
    onComplete(true);
  }.bind(this);

  var initialDisconnect = function() {
    this.port_.onMessage.removeListener(initialOnMessage);
    this.port_.onDisconnect.removeListener(initialDisconnect);
    onComplete(false);
  }.bind(this);

  this.port_.onMessage.addListener(initialOnMessage);
  this.port_.onDisconnect.addListener(initialDisconnect);
  this.port_.postMessage({'type':'auth-agent@openssh.com','data':[0]});
};

/**
 * @Override
 */
nassh.Stream.SSHAgentRelay.prototype.close = function(reason) {
  if (this.port_) this.port_.disconnect();
  nassh.Stream.prototype.close.call(this, reason);
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

  try {
    this.port_.postMessage({
        'type': 'auth-agent@openssh.com',
        'data': reqData
    });
  } catch (e) {
    this.close();
  }
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
