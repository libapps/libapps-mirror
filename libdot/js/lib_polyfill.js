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

// https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_objects/Object/values
// https://github.com/tc39/proposal-object-values-entries/blob/master/polyfill.js
if (!Object.values || !Object.entries) {
  const reduce = Function.bind.call(Function.call, Array.prototype.reduce);
  const isEnumerable = Function.bind.call(Function.call,
      Object.prototype.propertyIsEnumerable);
  const concat = Function.bind.call(Function.call, Array.prototype.concat);

  if (!Object.values) {
    Object.values = function values(O) {
      return reduce(Reflect.ownKeys(O), (v, k) => concat(v,
          typeof k === 'string' && isEnumerable(O, k) ? [O[k]] : []), []);
    };
  }

  if (!Object.entries) {
    Object.entries = function entries(O) {
      return reduce(Reflect.ownKeys(O), (e, k) => concat(e,
          typeof k === 'string' && isEnumerable(O, k) ? [[k, O[k]]] : []), []);
    };
  }
}
