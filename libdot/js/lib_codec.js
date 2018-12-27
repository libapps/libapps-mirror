// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.codec = {};

/**
 * Join an array of code units to a string.
 *
 * The code units must not be larger than 65535.  The individual code units may
 * be for UTF-8 or UTF-16 -- it doesn't matter since UTF-16 can handle all UTF-8
 * code units.
 *
 * The input array type may be an Array or a typed Array (e.g. Uint8Array).
 *
 * @param {Array<number>} array The code units to generate for the string.
 * @return {string} A UTF-16 encoded string.
 */
lib.codec.codeUnitArrayToString = function(array) {
  // String concat is faster than Array.join.
  let ret = '';
  for (let i = 0; i < array.length; ++i) {
    ret += String.fromCharCode(array[i]);
  }
  return ret;
};

/**
 * Create an array of code units from a UTF-16 encoded string.
 *
 * @param {string} str The string to extract code units from.
 * @return {Array<number>} The array of code units.
 */
lib.codec.stringToCodeUnitArray = function(str) {
  // Indexing string directly is faster than Array.map.
  const ret = new Array(str.length);
  for (let i = 0; i < str.length; ++i) {
    ret[i] = str.charCodeAt(i);
  }
  return ret;
};
