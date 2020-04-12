// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview nassh.buffer.ScatGat tests.
 */

describe('nassh_buffer_scatgat_tests.js', () => {

/**
 * Internal buffer inspector.
 */
class BufferInspector extends nassh.buffer.Inspector {
  /** @inheritDoc */
  getUnackedCount() {
    let ret = this.buffer.getUnreadCount();
    let pos = this.buffer.ackPos_;
    let off = this.buffer.ackOffset_;
    while (pos <= this.buffer.readPos_) {
      if (pos === this.buffer.readPos_) {
        ret += (this.buffer.readOffset_ - off);
      } else {
        const curr = this.buffer.queue_[pos];
        ret += (curr.length - off);
        off = 0;
      }
      ++pos;
    }
    return ret;
  }
}

nassh.buffer.ApiTest('scatgat', BufferInspector);

});
