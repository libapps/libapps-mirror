// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Polyfills for ES2016+ features we want to use.
 */

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
if (!String.prototype.padStart) {
  String.prototype.padStart = function(targetLength, padString) {
    // If the string is already long enough, nothing to do!
    targetLength -= this.length;
    if (targetLength <= 0)
      return String(this);

    if (padString === undefined)
      padString = ' ';

    // In case the pad is multiple chars long.
    if (targetLength > padString.length)
      padString = padString.repeat((targetLength / padString.length) + 1);

    return padString.slice(0, targetLength) + String(this);
  };
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padEnd
if (!String.prototype.padEnd) {
  String.prototype.padEnd = function(targetLength, padString) {
    // If the string is already long enough, nothing to do!
    targetLength -= this.length;
    if (targetLength <= 0)
      return String(this);

    if (padString === undefined)
      padString = ' ';

    // In case the pad is multiple chars long.
    if (targetLength > padString.length)
      padString = padString.repeat((targetLength / padString.length) + 1);

    return String(this) + padString.slice(0, targetLength);
  };
}
