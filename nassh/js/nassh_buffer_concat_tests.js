// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview nassh.buffer.Concat tests.
 */

describe('nassh_buffer_concat_tests.js', () => {

/**
 * Internal buffer inspector.
 */
class BufferInspector extends nassh.buffer.Inspector {
  /** @inheritDoc */
  getUnackedCount() {
    return this.buffer.buffer_.length;
  }
}

nassh.buffer.ApiTest('concat', BufferInspector);

});
