// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview The NaCl plugin leans on its host to provide some basic
 * stream-like objects.
 */

/**
 * Base class for streams required by the plugin.
 *
 * @param {number} fd
 * @param {string=} path
 * @constructor
 */
nassh.Stream = function(fd, path) {
  this.fd_ = fd;
  this.path = path;
  this.open = false;
};

/**
 * Errors we may raise.
 */
nassh.Stream.ERR_STREAM_CLOSED = 'Stream closed';
nassh.Stream.ERR_STREAM_OPENED = 'Stream opened';
nassh.Stream.ERR_FD_IN_USE = 'File descriptor in use';
nassh.Stream.ERR_NOT_IMPLEMENTED = 'Not implemented';
nassh.Stream.ERR_STREAM_CANT_READ = 'Stream has no read permission';
nassh.Stream.ERR_STREAM_CANT_WRITE = 'Stream has no write permission';

/**
 * Maximum number of queued bytes allowed in a WebSocket.
 *
 * This is the low water mark -- we stop queueing after we exceed this, but we
 * will keep sending messages as long as we're below it.
 *
 * The limit is checked against the WebSocket.bufferedAmount property which
 * tracks how much data has been queued but not yet drained by the platform.
 *
 * The WebSocket API says that if send() is unable to queue data because the
 * buffer is full, the platform will close the socket on us with an error.  It
 * is not possible to query the platform's limit however, so we pick an amount
 * that seems to be reasonable.  In practice on "normal" machines, we seem to
 * stay well beneath this limit, and the current stream protocols we support
 * use message sizes well below this limit.  Plus, if the platform is unable
 * to send/drain the data, us queuing more won't really help either.
 */
nassh.Stream.prototype.maxWebSocketBufferLength = 64 * 1024;

/**
 * Open a stream, calling back when complete.
 *
 * @param {!Object} settings Each subclass of nassh.Stream defines its own
 *     set of properties to be included in settings.
 * @param {function(boolean, ?string=)} onOpen
 */
nassh.Stream.prototype.asyncOpen = function(settings, onOpen) {
  setTimeout(() => onOpen(false, 'nassh.Stream.ERR_NOT_IMPLEMENTED'), 0);
};

/**
 * Read from a stream, calling back with the result.
 *
 * The default implementation does not actually send data to the client, but
 * assumes that it is instead pushed to the client using the
 * onDataAvailable event.
 *
 * @param {number} size
 * @param {function(!ArrayBuffer)} onRead
 */
nassh.Stream.prototype.asyncRead = function(size, onRead) {
  if (this.onDataAvailable === undefined) {
    throw nassh.Stream.ERR_NOT_IMPLEMENTED;
  }

  setTimeout(() => onRead(new ArrayBuffer(0)), 0);
};

/**
 * Write to a stream.
 *
 * @param {!ArrayBuffer} data
 * @param {function(number)} onSuccess
 */
nassh.Stream.prototype.asyncWrite = function(data, onSuccess) {
  throw nassh.Stream.ERR_NOT_IMPLEMENTED;
};

/**
 * Close a stream.
 */
nassh.Stream.prototype.close = function() {
  if (this.onClose) {
    this.onClose();
  }
};
