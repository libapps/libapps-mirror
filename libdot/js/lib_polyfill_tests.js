// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Unit tests for lib_polyfill.js.
 */

import {fromBase64, toBase64} from './lib_polyfill.js';

it('fromBase64', () => {
  const u8 = new Uint8Array([97, 98, 99, 100, 101, 102, 103]);
  // Check our polyfill.
  assert.deepStrictEqual(fromBase64('YWJjZGVmZw=='), u8);
  // Check the real API in case it isn't polyfilled.
  assert.deepStrictEqual(Uint8Array.fromBase64('YWJjZGVmZw=='), u8);
});

it('toBase64', () => {
  const u8 = new Uint8Array([97, 98, 99, 100, 101, 102, 103]);
  // Check our polyfill.
  assert.deepStrictEqual(toBase64.apply(u8), 'YWJjZGVmZw==');
  // Check the real API in case it isn't polyfilled.
  assert.deepStrictEqual(u8.toBase64(), 'YWJjZGVmZw==');
});
