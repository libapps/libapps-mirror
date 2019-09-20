// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Various codec test suites.
 */

describe('lib_codec_tests.js', () => {

/**
 * Test code unit array conversions to strings.
 */
it('codeUnitArrayToString', () => {
  // Check default Array handling.
  assert.equal('asdf', lib.codec.codeUnitArrayToString([97, 115, 100, 102]));

  // Check typed array handling.
  const u8 = new Uint8Array([97, 115, 100, 102]);
  assert.equal('asdf', lib.codec.codeUnitArrayToString(u8));

  // Check UTF-16 pairs.
  assert.equal('\u{1fadc}', lib.codec.codeUnitArrayToString([55358, 57052]));
});

/**
 * Test string conversions to code unit arrays.
 */
it('stringToCodeUnitArray', () => {
  let ret;

  // Check default Uint8Array handling.
  ret = lib.codec.stringToCodeUnitArray('asdf');
  assert.deepStrictEqual(new Uint8Array([97, 115, 100, 102]), ret);
  assert.isTrue(ArrayBuffer.isView(ret));

  // Check UTF-16 pairs.
  const s = '\u{1fadc}';
  ret = lib.codec.stringToCodeUnitArray(s, new Uint16Array(s.length));
  assert.deepStrictEqual(new Uint16Array([55358, 57052]), ret);
  assert.isTrue(ArrayBuffer.isView(ret));
});

});
