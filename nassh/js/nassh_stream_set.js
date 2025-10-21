// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {Stream} from './nassh_stream.js';

/**
 * A set of open streams for a command instance.
 */
export class StreamSet {
  constructor() {}

  /**
   * Open a new stream instance of a given class.
   *
   * @param {function(new:Stream)} streamClass
   * @param {!Object} arg
   * @param {function(boolean, ?string=)} onOpen
   * @return {!Stream}
   */
  openStream(streamClass, arg, onOpen) {
    const stream = new streamClass();

    stream.asyncOpen(arg, (success, errorMessage) => {
      if (success) {
        stream.open = true;
      }

      onOpen(success, errorMessage);
    });

    return stream;
  }
}
