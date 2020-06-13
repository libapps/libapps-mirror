// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Polyfills for ES2019+ features we want to use.
 * @suppress {duplicate} This file redefines many functions.
 */

/** @const */
lib.polyfill = {};

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer
 *
 * @return {!Promise<!ArrayBuffer>}
 */
lib.polyfill.BlobArrayBuffer = function() {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onabort = reader.onerror = () => reject(reader);
    reader.readAsArrayBuffer(this);
  });
};

if (typeof Blob.prototype.arrayBuffer != 'function') {
  Blob.prototype.arrayBuffer = lib.polyfill.BlobArrayBuffer;
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/Blob/text
 *
 * @return {!Promise<string>}
 */
lib.polyfill.BlobText = function() {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onabort = reader.onerror = () => reject(reader);
    reader.readAsText(this);
  });
};

if (typeof Blob.prototype.arrayBuffer != 'function') {
  Blob.prototype.text = lib.polyfill.BlobText;
}
