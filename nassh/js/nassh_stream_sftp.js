// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Stream for passing binary SFTP data through.
 */

import {Client as sftpClient} from './nassh_sftp_client.js';
import {Stream} from './nassh_stream.js';

/**
 * The sftp packet stream.
 *
 * @param {number} fd
 * @param {{client: !sftpClient}} info
 * @constructor
 * @extends {Stream}
 */
export function SftpStream(fd, info) {
  Stream.apply(this, [fd]);

  this.acknowledgeCount_ = 0;
  this.client_ = info.client;
}

SftpStream.prototype = Object.create(Stream.prototype);
/** @override */
SftpStream.constructor = SftpStream;

/**
 * Open the stream asynchronously.
 *
 * @param {!Object} settings
 * @param {function(boolean)} onOpen
 * @override
 */
SftpStream.prototype.asyncOpen = async function(settings, onOpen) {
  this.acknowledgeCount_ = 0;

  setTimeout(() => onOpen(true), 0);
};

/**
 * Write to the stream asynchronously.
 *
 * @param {!ArrayBuffer} data
 * @param {function(number)} onSuccess
 * @override
 */
SftpStream.prototype.asyncWrite = function(data, onSuccess) {
  if (!this.open) {
    throw Stream.ERR_STREAM_CLOSED;
  }

  this.acknowledgeCount_ += data.byteLength;
  this.client_.writeStreamData(data);

  setTimeout(() => onSuccess(this.acknowledgeCount_), 0);
};
