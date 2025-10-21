// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {Stream} from './nassh_stream.js';

/**
 * A set of open streams for a command instance.
 */
export class StreamSet {
  constructor() {
    /**
     * Collection of currently open stream instances.
     *
     * @private {!Object<number, !Stream>}
     * @const
     */
    this.openStreams_ = {};
  }

  /**
   * Open a new stream instance of a given class.
   *
   * @param {function(new:Stream, number, ?)} streamClass
   * @param {number} fd
   * @param {!Object} arg
   * @param {function(boolean, ?string=)} onOpen
   * @return {!Stream}
   */
  openStream(streamClass, fd, arg, onOpen) {
    if (this.openStreams_[fd]) {
      throw Stream.ERR_FD_IN_USE;
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
  }
}
