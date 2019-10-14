// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Stream for passing binary SFTP data through.
 */

/**
 * The sftp packet stream.
 *
 * @param {number} fd
 * @param {{client: !nassh.sftp.Client}} info
 * @constructor
 * @extends {nassh.Stream}
 */
nassh.Stream.Sftp = function(fd, info) {
  nassh.Stream.apply(this, [fd]);

  this.acknowledgeCount_ = 0;
  this.client_ = info.client;
};

nassh.Stream.Sftp.prototype = Object.create(nassh.Stream.prototype);
/** @override */
nassh.Stream.Sftp.constructor = nassh.Stream.Sftp;

/**
 * Open the stream asynchronously.
 *
 * @param {!Object} settings
 * @param {function(boolean)} onOpen
 * @override
 */
nassh.Stream.Sftp.prototype.asyncOpen = function(settings, onOpen) {
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
nassh.Stream.Sftp.prototype.asyncWrite = function(data, onSuccess) {
  if (!this.open) {
    throw nassh.Stream.ERR_STREAM_CLOSED;
  }

  this.acknowledgeCount_ += data.byteLength;
  this.client_.writeStreamData(data);

  setTimeout(() => onSuccess(this.acknowledgeCount_), 0);
};
