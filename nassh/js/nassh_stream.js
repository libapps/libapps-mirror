// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview: The NaCl plugin leans on its host to provide some basic
 * stream-like objects for /dev/random. The interface is likely to change
 * in the near future, so documentation in this file is a bit sparse.
 */

/**
 * Base class for streams required by the plugin.
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
 * Convert binary byte array into base64 ascii.
 *
 * @param {!Array<!number>} b An array of bytes.
 * @return {!string} The base64 encoding of the byte array.
 */
nassh.Stream.binaryToAscii = function(b) {
  return btoa(b.map((byte) => String.fromCharCode(byte)).join(''));
};

/**
 * Convert ascii base64 into binary byte array.
 *
 * @param {!string} a A base64-encoded string.
 * @return {!Array<!number>} The array of byte values encoded in the string.
 */
nassh.Stream.asciiToBinary = function(a) {
  return Array.prototype.map.call(atob(a), (char) => char.charCodeAt(0));
};

/**
 * Open a stream, calling back when complete.
 */
nassh.Stream.prototype.asyncOpen_ = function(path, onOpen) {
  setTimeout(function() { onOpen(false) }, 0);
};

/**
 * Read from a stream, calling back with the result.
 *
 * The default implementation does not actually send data to the client, but
 * assumes that it is instead pushed to the client using the
 * onDataAvailable event.
 */
nassh.Stream.prototype.asyncRead = function(size, onRead) {
  if (this.onDataAvailable === undefined)
    throw nassh.Stream.ERR_NOT_IMPLEMENTED;

  setTimeout(() => onRead(''), 0);
};

/**
 * Write to a stream.
 */
nassh.Stream.prototype.asyncWrite = function(data, onSuccess) {
  throw nassh.Stream.ERR_NOT_IMPLEMENTED;
};

/**
 * Close a stream.
 */
nassh.Stream.prototype.close = function(reason) {
  if (this.onClose)
    this.onClose(reason || 'closed');
};

/**
 * Set a new IO for the stream.
 */
nassh.Stream.prototype.setIo = function(io) {
  this.io_ = io;
};

/**
 * The /dev/random stream.
 *
 * This special case stream just returns random bytes when read.
 */
nassh.Stream.Random = function(fd) {
  nassh.Stream.apply(this, [fd]);
};

nassh.Stream.Random.prototype = Object.create(nassh.Stream.prototype);
nassh.Stream.Random.constructor = nassh.Stream.Random;

nassh.Stream.Random.prototype.asyncOpen_ = function(path, onOpen) {
  this.path = path;
  setTimeout(function() { onOpen(true) }, 0);
};

nassh.Stream.Random.prototype.asyncRead = function(size, onRead) {
  if (!this.open)
    throw nassh.Stream.ERR_STREAM_CLOSED;

  var bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  Array.prototype.map.apply(
      bytes, [function(el) { return String.fromCharCode(el) }]);

  var b64bytes = btoa(Array.prototype.join.apply(bytes, ['']));

  setTimeout(function() { onRead(b64bytes) }, 0);
};
