// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.jsfs = {};

/**
 * Convert the given ArrayBuffer into a utf8 string.
 *
 * @param {ArrayBuffer} buffer.
 * @return {string}
 */
wam.jsfs.arrayBufferToUTF8 = function(buffer) {
  var view = new DataView(buffer);
  var ary = [];
  ary.length = buffer.byteLength;
  for (var i = 0; i < buffer.byteLength; i++) {
      ary[i] = String.fromCharCode(view.getUint8(i));
  }

  return ary.join('');
};
