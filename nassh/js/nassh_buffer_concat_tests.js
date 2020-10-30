// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview ConcatBuffer tests.
 */

import {BufferApiTest, BufferInspector} from './nassh_buffer_tests.js';
import {ConcatBuffer} from './nassh_buffer_concat.js';

describe('nassh_buffer_concat_tests.js', () => {

/**
 * Internal buffer inspector.
 */
class Inspector extends BufferInspector {
  /** @inheritDoc */
  getUnackedCount() {
    const buffer = /** @type {!ConcatBuffer} */ (this.buffer);
    return buffer.buffer_.length;
  }
}

BufferApiTest('concat', Inspector);

});
