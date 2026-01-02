// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview SSH agent implementation using Agent to relay requests to
 *     backends.
 */

import {concatTyped} from './lib_array.js';
import {Agent} from './nassh_agent.js';
import {Stream} from './nassh_stream.js';

/**
 * Relay ssh-agent messages to an Agent instance.
 */
export class SshAgentStream extends Stream {
  /**
   * @param {{authAgent: !Agent}} options
   */
  constructor({authAgent}) {
    super();

    this.authAgent_ = authAgent;
    this.pendingMessageSize_ = null;
    this.writeBuffer_ = new Uint8Array(0);
  }

  /**
   * Open a connection to the agent and let it initialize its backends.
   *
   * @param {!Object} settings
   * @return {!Promise<void>}
   * @override
   */
  async open(settings) {
    try {
      return this.authAgent_.ping();
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Check whether there is enough data in the write buffer to constitute a
   * packet. If so, send packet to Agent and relay its reply.
   *
   * @private
   */
  trySendPacket_() {
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
    this.writeBuffer_ = this.writeBuffer_.subarray(
        4 + this.pendingMessageSize_);
    // Restart the message process.
    this.pendingMessageSize_ = null;

    this.authAgent_.handleRequest(reqData)
        .then((response) => this.onDataAvailable(response.rawMessage()));
  }

  /**
   * Append data to write buffer.
   *
   * @param {!ArrayBuffer} data The bytes to append to the current stream.
   * @override
   */
  async write(data) {
    if (!data.byteLength) {
      return;
    }

    this.writeBuffer_ = concatTyped(this.writeBuffer_, new Uint8Array(data));

    setTimeout(this.trySendPacket_.bind(this), 0);
  }
}
