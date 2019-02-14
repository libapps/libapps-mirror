// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Relay ssh-agent messages to another app.
 *
 * @param {number} fd
 * @constructor
 * @extends {nassh.Stream}
 */
nassh.Stream.SSHAgentRelay = function(fd) {
  nassh.Stream.apply(this, [fd]);

  this.authAgentAppID_ = null;
  this.port_ = null;
  this.pendingMessageSize_ = null;
  this.writeBuffer_ = nassh.buffer.new(/* autoack= */ true);
};

/**
 * We are a subclass of nassh.Stream.
 */
nassh.Stream.SSHAgentRelay.prototype = Object.create(nassh.Stream.prototype);
/** @override */
nassh.Stream.SSHAgentRelay.constructor = nassh.Stream.SSHAgentRelay;

/**
 * Open a connection to agent.
 *
 * @param {!Object} settings
 * @param {function(boolean, ?string=)} onComplete
 * @override
 */
nassh.Stream.SSHAgentRelay.prototype.asyncOpen = function(
    settings, onComplete) {
  this.authAgentAppID_ = settings.authAgentAppID;
  this.port_ = chrome.runtime.connect(this.authAgentAppID_);

  // The other extension (e.g. gnubby) sent us a raw ssh-agent message.
  // Forward it along to the ssh process.
  const normalOnMessage = (msg) => {
    if (msg.data) {
      // The ssh-agent protocol requires a 4-byte length header, so add that
      // to the buffer before sending to the ssh process.
      const size = msg.data.length;
      const buffer = new ArrayBuffer(size + 4);
      const dv = new DataView(buffer);

      // The 4-byte length.
      dv.setUint32(0, size);

      // Append body.
      const body = new Uint8Array(buffer, 4);
      body.set(msg.data);

      // Report to client.
      this.onDataAvailable(buffer);

      // Re-examine write buffer; there might be more data in it.
      setTimeout(this.trySendPacket_.bind(this), 0);
    }
  };

  const normalDisconnect = () => {
    this.port_.onMessage.removeListener(normalOnMessage);
    this.port_.onDisconnect.removeListener(normalDisconnect);
    this.close();
  };

  const initialOnMessage = (msg) => {
    this.port_.onMessage.removeListener(initialOnMessage);
    this.port_.onDisconnect.removeListener(initialDisconnect);
    this.port_.onMessage.addListener(normalOnMessage);
    this.port_.onDisconnect.addListener(normalDisconnect);
    onComplete(true);
  };

  const initialDisconnect = () => {
    this.port_.onMessage.removeListener(initialOnMessage);
    this.port_.onDisconnect.removeListener(initialDisconnect);
    onComplete(false, lib.f.lastError());
  };

  this.port_.onMessage.addListener(initialOnMessage);
  this.port_.onDisconnect.addListener(initialDisconnect);
  this.port_.postMessage({'type': 'auth-agent@openssh.com', 'data': [0]});
};

/**
 * @override
 */
nassh.Stream.SSHAgentRelay.prototype.close = function() {
  if (this.port_) {
    this.port_.disconnect();
  }
  nassh.Stream.prototype.close.call(this);
};

/**
 * Check whether there is enough data in the write buffer to constitute a
 * packet. If so, send packet and handle reply.
 */
nassh.Stream.SSHAgentRelay.prototype.trySendPacket_ = function() {
  // See if we've scanned the message length yet (first 4 bytes).
  if (this.pendingMessageSize_ === null) {
    if (this.writeBuffer_.getUnreadCount() < 4) {
      return;
    }

    // Pull out the 32-bit message length.
    const bytes = this.writeBuffer_.read(4);
    const dv = new DataView(bytes.buffer, bytes.byteOffset);
    this.pendingMessageSize_ = dv.getUint32(0);
  }

  // See if we've got the message body yet.
  if (this.writeBuffer_.getUnreadCount() <
      lib.notNull(this.pendingMessageSize_)) {
    return;
  }

  // Send the body to the extension.
  const data = this.writeBuffer_.read(this.pendingMessageSize_);
  // Restart the message process.
  this.pendingMessageSize_ = null;

  // The postMessage API only accepts JavaScript Arrays, so convert it.
  try {
    this.port_.postMessage({
      'type': 'auth-agent@openssh.com',
      'data': Array.from(data),
    });
  } catch (e) {
    this.close();
  }
};

/**
 * Append data to write buffer.
 *
 * @param {!ArrayBuffer} data
 * @param {function(number)} onSuccess
 * @override
 */
nassh.Stream.SSHAgentRelay.prototype.asyncWrite = function(data, onSuccess) {
  if (!data.byteLength) {
    return;
  }

  this.writeBuffer_.write(data);

  setTimeout(this.trySendPacket_.bind(this), 0);

  // Note: report binary length written.
  onSuccess(data.byteLength);
};
