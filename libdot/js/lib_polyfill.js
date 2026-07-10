// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Polyfills for ES2021+ features we want to use.
 * @suppress {duplicate} This file redefines many functions.
 */

import {lib} from './lib.js';

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/fromBase64
 * @param {string} string
 * @return {!Uint8Array}
 */
export function fromBase64(string) {
  return /** @type {!Uint8Array} */ (
      lib.codec.stringToCodeUnitArray(atob(string)));
}

if (Uint8Array.fromBase64 === undefined) {
  Uint8Array.fromBase64 = fromBase64;
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/toBase64
 * @this {Uint8Array}
 * @return {string}
 */
export function toBase64() {
  return btoa(lib.codec.codeUnitArrayToString(this));
}

if (Uint8Array.prototype.toBase64 === undefined) {
  Uint8Array.prototype.toBase64 = toBase64;
}
