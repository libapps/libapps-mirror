// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * A set of open streams for a command instance.
 *
 * @constructor
 */
export function StreamSet() {
  /**
   * Collection of currently open stream instances.
   *
   * @private {!Object<number, !nassh.Stream>}
   * @const
   */
  this.openStreams_ = {};
}

/**
 * Open a new stream instance of a given class.
 *
 * @param {function(new:nassh.Stream, number, ?)} streamClass
 * @param {number} fd
 * @param {!Object} arg
 * @param {function(boolean, ?string=)} onOpen
 * @return {!nassh.Stream}
 */
StreamSet.prototype.openStream = function(streamClass, fd, arg, onOpen) {
  if (this.openStreams_[fd]) {
    throw nassh.Stream.ERR_FD_IN_USE;
  }

  const stream = new streamClass(fd, arg);

  stream.asyncOpen(arg, (success, errorMessage) => {
      if (success) {
        this.openStreams_[fd] = stream;
        stream.open = true;
      }

      onOpen(success, errorMessage);
    });

  return stream;
};

/**
 * Closes a stream instance.
 *
 * @param {number} fd
 */
StreamSet.prototype.closeStream = function(fd) {
  const stream = this.openStreams_[fd];
  stream.close();
  stream.open = false;
  delete this.openStreams_[fd];
};

/**
 * Closes all stream instances.
 */
StreamSet.prototype.closeAllStreams = function() {
  for (const fd in this.openStreams_) {
    this.closeStream(Number(fd));
  }
};

/**
 * Returns a stream instance.
 *
 * @param {number} fd
 * @return {!nassh.Stream}
 */
StreamSet.prototype.getStreamByFd = function(fd) {
  return this.openStreams_[fd];
};
