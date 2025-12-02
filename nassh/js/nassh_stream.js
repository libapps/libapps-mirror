// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview The plugin leans on its host to provide some basic
 * stream-like objects.
 */

/**
 * Base class for streams required by the plugin.
 *
 * @constructor
 */
export function Stream() {}

/**
 * Errors we may raise.
 */
Stream.ERR_STREAM_CLOSED = 'Stream closed';
Stream.ERR_STREAM_OPENED = 'Stream opened';
Stream.ERR_NOT_IMPLEMENTED = 'Not implemented';
Stream.ERR_STREAM_CANT_READ = 'Stream has no read permission';
Stream.ERR_STREAM_CANT_WRITE = 'Stream has no write permission';

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
Stream.prototype.maxWebSocketBufferLength = 64 * 1024;

/**
 * Open a stream.
 *
 * @param {!Object} settings Each subclass of Stream defines its own set of
 *     properties to be included in settings.
 * @return {!Promise<void>} Resolve when open completes.
 */
Stream.prototype.open = async function(settings) {
  throw Stream.ERR_NOT_IMPLEMENTED;
};

/**
 * Write to a stream.
 *
 * @param {!ArrayBuffer} data
 */
Stream.prototype.write = async function(data) {
  throw Stream.ERR_NOT_IMPLEMENTED;
};

/**
 * Close a stream.
 */
Stream.prototype.close = function() {
  if (this.onClose) {
    this.onClose();
  }
};

/**
 * Notification interface for when data is available for reading.
 */
Stream.prototype.onDataAvailable = undefined;
