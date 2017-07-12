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
nassh.Stream.SSHAgentRelay.prototype = Object.create(nassh.Stream.prototype);
nassh.Stream.SSHAgentRelay.constructor = nassh.Stream.SSHAgentRelay;

/**
 * Open a connection to agent.
 */
nassh.Stream.SSHAgentRelay.prototype.asyncOpen_ = function(args, onComplete) {
  this.authAgentAppID_ = args.authAgentAppID;
  this.port_ = chrome.runtime.connect(this.authAgentAppID_);

  var normalOnMessage = (msg) => {
    if (msg.data) {
      // Prepare header.
      var size = msg.data.length;
      var hdr = lib.array.uint32ToArrayBigEndian(size);
      // Append body.
      var bData = hdr.concat(msg.data);

      // Report to client.
      this.onDataAvailable(nassh.Stream.binaryToAscii(bData));

      // Re-examine write buffer; there might be more data in it.
      setTimeout(this.trySendPacket_.bind(this), 0);
    }
  };

  var normalDisconnect = () => {
    this.port_.onMessage.removeListener(normalOnMessage);
    this.port_.onDisconnect.removeListener(normalDisconnect);
    this.close();
  };

  var initialOnMessage = (msg) => {
    this.port_.onMessage.removeListener(initialOnMessage);
    this.port_.onDisconnect.removeListener(initialDisconnect);
    this.port_.onMessage.addListener(normalOnMessage);
    this.port_.onDisconnect.addListener(normalDisconnect);
    onComplete(true);
  };

  var initialDisconnect = () => {
    this.port_.onMessage.removeListener(initialOnMessage);
    this.port_.onDisconnect.removeListener(initialDisconnect);
    onComplete(false);
  };

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
 * Check whether there is enough data in the write buffer to constitute a packet.
 * If so, send packet and handle reply.
 */
nassh.Stream.SSHAgentRelay.prototype.trySendPacket_ = function() {
  // Message header, 4 bytes of length.
  if (this.writeBuffer_.length < 4) return;

  var size = lib.array.arrayBigEndianToUint32(this.writeBuffer_);

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

  var bData = nassh.Stream.asciiToBinary(data);
  this.writeBuffer_ = this.writeBuffer_.concat(bData);

  setTimeout(this.trySendPacket_.bind(this), 0);

  // Note: report binary length written.
  onSuccess(bData.length);
};
