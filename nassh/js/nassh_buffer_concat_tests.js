// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview ConcatBuffer tests.
 */

import {BufferApiTest, BufferInspector} from './nassh_buffer_test_util.js';
import {ConcatBuffer} from './nassh_buffer_concat.js';

/**
 * Internal buffer inspector.
 */
class Inspector extends BufferInspector {
  /**
   * @return {number}
   * @override
   */
  getUnackedCount() {
    const buffer = /** @type {!ConcatBuffer} */ (this.buffer);
    return buffer.buffer_.length;
  }
}

BufferApiTest('concat', Inspector);
