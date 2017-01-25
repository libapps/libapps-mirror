// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * A set of open streams for a command instance.
 */
nassh.StreamSet = function() {
  // Collection of currently open stream instances.
  this.openStreams_ = {};
};

/**
 * Open a new stream instance of a given class.
 */
nassh.StreamSet.prototype.openStream = function(streamClass, fd, arg, onOpen) {
  if (this.openStreams_[fd])
    throw nassh.Stream.ERR_FD_IN_USE;

  var stream = new streamClass(fd, arg);

  stream.asyncOpen_(arg, (success) => {
      if (success) {
        this.openStreams_[fd] = stream;
        stream.open = true;
      }

      onOpen(success, stream);
    });

  return stream;
};

/**
 * Closes a stream instance.
 */
nassh.StreamSet.prototype.closeStream = function(fd, reason) {
  this.openStreams_[fd].close(reason);
  delete this.openStreams_[fd];
};

/**
 * Closes all stream instances.
 */
nassh.StreamSet.prototype.closeAllStreams = function() {
  for (var fd in this.openStreams_) {
    this.closeStream(fd);
  }
}

/**
 * Returns a stream instance.
 */
nassh.StreamSet.prototype.getStreamByFd = function(fd) {
  return this.openStreams_[fd];
}
