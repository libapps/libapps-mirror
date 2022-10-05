// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Helper functions for (typed) arrays.
 */

/**
 * Concatenate an arbitrary number of typed arrays of the same type into a new
 * typed array of this type.
 *
 * @template TYPED_ARRAY
 * @param {...!TYPED_ARRAY} arrays
 * @return {!TYPED_ARRAY}
 */
export function concatTyped(...arrays) {
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
}

/**
 * Compare two array-like objects entrywise.
 *
 * @template ARRAY_LIKE
 * @param {?ARRAY_LIKE} a The first array to compare.
 * @param {?ARRAY_LIKE} b The second array to compare.
 * @return {boolean} true if both arrays are null or they agree entrywise;
 *     false otherwise.
 */
export function compare(a, b) {
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
}
