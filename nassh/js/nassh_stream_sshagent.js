// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview SSH agent implementation using nassh.agent.Agent to relay
 * requests to backends.
 */

/**
 * Relay ssh-agent messages to an nassh.agent.Agent instance.
 *
 * @param fd
 * @param {{authAgent: !nassh.agent.Agent}} args
 * @constructor
 * @implements nassh.Stream
 */
nassh.Stream.SSHAgent = function(fd, args) {
  nassh.Stream.apply(this, [fd]);

  this.authAgent_ = args.authAgent;
  this.pendingMessageSize_ = null;
  this.writeBuffer_ = new Uint8Array();
};

nassh.Stream.SSHAgent.prototype = Object.create(nassh.Stream.prototype);
nassh.Stream.SSHAgent.constructor = nassh.Stream.SSHAgent;

/**
 * Open a connection to the agent and let it initialize its backends.
 *
 * @param args
 * @param onComplete
 * @private
 */
nassh.Stream.SSHAgent.prototype.asyncOpen_ = function(args, onComplete) {
  try {
    this.authAgent_.ping().then(() => onComplete(true));
  } catch (e) {
    console.log(e);
    onComplete(false, e.toString());
  }
};

/**
 * Check whether there is enough data in the write buffer to constitute a
 * packet. If so, send packet to Agent and relay its reply.
 * @private
 */
nassh.Stream.SSHAgent.prototype.trySendPacket_ = function() {
  // See if we've scanned the message length yet (first 4 bytes).
  if (this.pendingMessageSize_ === null) {
    if (this.writeBuffer_.length < 4) {
      return;
    }

    // Read the 32-bit message length.
    const dv = new DataView(
        this.writeBuffer_.buffer, this.writeBuffer_.byteOffset);
    this.pendingMessageSize_ = dv.getUint32(0);
  }

  // See if we've got the message body yet.
  if (this.writeBuffer_.length < 4 + this.pendingMessageSize_) {
    return;
  }

  // Consume header + body.
  const reqData = this.writeBuffer_.subarray(0, 4 + this.pendingMessageSize_);
  this.writeBuffer_ = this.writeBuffer_.subarray(4 + this.pendingMessageSize_);
  // Restart the message process.
  this.pendingMessageSize_ = null;

  this.authAgent_.handleRequest(reqData)
      .then(
          (response) => this.onDataAvailable(
              btoa(lib.codec.codeUnitArrayToString(response.rawMessage()))));
};

/**
 * Append data to write buffer.
 *
 * @param {ArrayBuffer} data The bytes to append to the current stream.
 * @param {function(number)} onSuccess Callback once the data is queued.
 */
nassh.Stream.SSHAgent.prototype.asyncWrite = function(data, onSuccess) {
  if (!data.byteLength) {
    return;
  }

  this.writeBuffer_ = lib.array.concatTyped(
      this.writeBuffer_, new Uint8Array(data));

  setTimeout(this.trySendPacket_.bind(this), 0);

  // Note: report binary length written.
  onSuccess(data.byteLength);
};
