// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Helper functions for (typed) arrays.
 */

lib.array = {};

/**
 * Convert an array of four unsigned bytes into an unsigned 32-bit integer (big
 * endian).
 *
 * @param {!Array.<!number>} array
 * @returns {!number}
 */
lib.array.arrayBigEndianToUint32 = function(array) {
  const maybeSigned =
      (array[0] << 24) | (array[1] << 16) | (array[2] << 8) | (array[3] << 0);
  // Interpret the result of the bit operations as an unsigned integer.
  return maybeSigned >>> 0;
};

/**
 * Convert an unsigned 32-bit integer into an array of four unsigned bytes (big
 * endian).
 *
 * @param {!number} uint32
 * @returns {!Array.<!number>}
 */
lib.array.uint32ToArrayBigEndian = function(uint32) {
  return [
    (uint32 >>> 24) & 0xFF,
    (uint32 >>> 16) & 0xFF,
    (uint32 >>> 8) & 0xFF,
    (uint32 >>> 0) & 0xFF,
  ];
};

/**
 * Concatenate an arbitrary number of typed arrays of the same type into a new
 * typed array of this type.
 *
 * @template TYPED_ARRAY
 * @param {...!TYPED_ARRAY} arrays
 * @returns {!TYPED_ARRAY}
 */
lib.array.concatTyped = function(...arrays) {
  let resultLength = 0;
  for (const array of arrays) {
    resultLength += array.length;
  }
  const result = new arrays[0].constructor(resultLength);
  let pos = 0;
  for (const array of arrays) {
    result.set(array, pos);
    pos += array.length;
  }
  return result;
};

/**
 * Compare two array-like objects entrywise.
 *
 * @template ARRAY_LIKE
 * @param {?ARRAY_LIKE} a
 * @param {?ARRAY_LIKE} b
 * @returns {!boolean} true if both arrays are null or they agree entrywise;
 *     false otherwise.
 */
lib.array.compare = function(a, b) {
  if (a === null || b === null) {
    return a === null && b === null;
  }

  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};
