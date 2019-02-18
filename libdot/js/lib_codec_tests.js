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

  // Check default Array handling.
  ret = lib.codec.stringToCodeUnitArray('asdf');
  assert.deepStrictEqual([97, 115, 100, 102], ret);
  assert.isTrue(Array.isArray(ret));

  // Check typed array handling.
  ret = lib.codec.stringToCodeUnitArray('asdf', Uint8Array);
  assert.deepStrictEqual(new Uint8Array([97, 115, 100, 102]), ret);
  assert.isTrue(ArrayBuffer.isView(ret));

  // Check UTF-16 pairs.
  assert.deepStrictEqual(
      [55358, 57052], lib.codec.stringToCodeUnitArray('\u{1fadc}'));
});

});
