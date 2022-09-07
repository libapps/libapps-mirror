// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview ScatGatBuffer tests.
 */

import {BufferApiTest, BufferInspector} from './nassh_buffer_tests.js';
import {ScatGatBuffer} from './nassh_buffer_scatgat.js';

describe('nassh_buffer_scatgat_tests.js', () => {

/**
 * Internal buffer inspector.
 */
class Inspector extends BufferInspector {
  /** @inheritDoc */
  getUnackedCount() {
    const buffer = /** @type {!ScatGatBuffer} */ (this.buffer);
    let ret = buffer.getUnreadCount();
    let pos = buffer.ackPos_;
    let off = buffer.ackOffset_;
    while (pos <= buffer.readPos_) {
      if (pos === buffer.readPos_) {
        ret += (buffer.readOffset_ - off);
      } else {
        const curr = buffer.queue_[pos];
        ret += (curr.length - off);
        off = 0;
      }
      ++pos;
    }
    return ret;
  }
}

BufferApiTest('scatgat', Inspector);

});
