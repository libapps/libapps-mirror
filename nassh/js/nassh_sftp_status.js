// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../../libdot/index.js';

/**
 * The SFTP Status Error extends the Error class. It takes a StatusPacket and
 * an expectedPacketType and creates an informative Error message while
 * preserving the status code.
 */
export class StatusError {
  /**
   * @param {!Object} statusPacket
   * @param {string} expectedPacketType
   */
  constructor(statusPacket, expectedPacketType) {
    this.name = 'StatusError';
    this.code = statusPacket.code;
    this.message =
        `Received StatusPacket error in response to ${expectedPacketType} ` +
        `packet: ${statusPacket.message}`;
    this.stack = lib.f.getStack();
  }
}
