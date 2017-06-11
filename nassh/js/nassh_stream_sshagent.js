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
  this.writeBuffer_ = [];
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
    this.authAgent_.ping().then(() => onComplete(true))
  } catch (e) {
    console.log(e);
    onComplete(false);
  }
};

/**
 * Check whether there is enough data in the write buffer to constitute a
 * packet. If so, send packet to Agent and relay its reply.
 * @private
 */
nassh.Stream.SSHAgent.prototype.trySendPacket_ = function() {
  // Message header, 4 bytes of length.
  if (this.writeBuffer_.length < 4) {
    return;
  }

  const size = lib.array.arrayBigEndianToUint32(this.writeBuffer_);
  // Message body.
  if (this.writeBuffer_.length < 4 + size) {
    return;
  }

  // Consume header + body.
  const reqData = this.writeBuffer_.splice(0, 4 + size);

  this.authAgent_.handleRequest(new Uint8Array(reqData))
      .then(
          (response) => this.onDataAvailable(
              nassh.Stream.binaryToAscii(Array.from(response.rawMessage()))));
};

/**
 * Append data to write buffer.
 *
 * @param data
 * @param onSuccess
 */
nassh.Stream.SSHAgent.prototype.asyncWrite = function(data, onSuccess) {
  if (!data.length) {
    return;
  }

  const bData = nassh.Stream.asciiToBinary(data);
  this.writeBuffer_ = this.writeBuffer_.concat(bData);

  setTimeout(this.trySendPacket_.bind(this), 0);

  // Note: report binary length written.
  onSuccess(bData.length);
};
