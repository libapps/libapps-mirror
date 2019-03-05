// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Test suite for array helper functions.
 */

describe('lib_array_tests.js', () => {

it('concatTyped', () => {
  const subtests = [
    [[new Uint8Array([]), new Uint8Array([])], new Uint8Array([]), 'empty'],
    [
      [
        new Uint16Array([1, 2]),
        new Uint16Array([3, 4]),
      ],
      new Uint16Array([1, 2, 3, 4]),
      'two arrays',
    ],
    [
      [
        new Int32Array([1, 2]),
        new Int32Array([3, 4]),
        new Int32Array([5, 6]),
      ],
      new Int32Array([1, 2, 3, 4, 5, 6]),
      'three arrays',
    ],
  ];

  subtests.forEach((data) => {
    const concatenated = lib.array.concatTyped(...data[0]);
    // Check whether result has the correct type.
    assert.isTrue(
        concatenated instanceof data[1].constructor &&
            data[1] instanceof concatenated.constructor,
        'type');
    assert.deepStrictEqual(
        Array.from(concatenated), Array.from(data[1]), data[2]);
  });
});

it('compare', () => {
  const subtests = [
    [[null, null], true, 'both null'],
    [[[], null], false, 'first null'],
    [[null, []], false, 'second null'],
    [[[], []], true, 'both empty'],
    [[[], [1]], false, 'first empty'],
    [[[1], []], false, 'second empty'],
    [[[1, 2], [1, 2, 3]], false, 'first shorter'],
    [[[1, 2, 3], [1, 2]], false, 'second shorter'],
    [[[1, 2, 3], [1, 2, 4]], false, 'same length'],
    [
      [new Uint8Array([1, 2, 4]), new Uint8Array([1, 2, 4])],
      true,
      'typed array',
    ],
  ];

  subtests.forEach((data) => {
    assert.equal(lib.array.compare(data[0][0], data[0][1]), data[1], data[2]);
  });
});

});
