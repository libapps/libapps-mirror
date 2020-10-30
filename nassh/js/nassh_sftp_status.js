// Copyright (c) 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * The SFTP Status Error extends the Error class. It takes a
 * nassh.sftp.statusPacket and an expectedPacketType and creates an informative
 * Error message while preserving the status code.
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
