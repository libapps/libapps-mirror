// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Polyfills for ES2016+ features we want to use.
 * @suppress {duplicate} This file redefines many functions.
 */

/** @const */
lib.polyfill = {};

/**
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
 */
lib.polyfill.stringPadStart = function() {
  /**
   * @param {number} targetLength
   * @param {string=} padString
   * @return {string}
   */
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
};

if (!String.prototype.padStart) {
  lib.polyfill.stringPadStart();
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padEnd
 */
lib.polyfill.stringPadEnd = function() {
  /**
   * @param {number} targetLength
   * @param {string=} padString
   * @return {string}
   */
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
};

if (!String.prototype.padEnd) {
  lib.polyfill.stringPadEnd();
}

/**
 * https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_objects/Object/values
 * https://github.com/tc39/proposal-object-values-entries/blob/master/polyfill.js
 */
lib.polyfill.object = function() {
  const reduce = Function.bind.call(Function.call, Array.prototype.reduce);
  const isEnumerable = Function.bind.call(Function.call,
      Object.prototype.propertyIsEnumerable);
  const concat = Function.bind.call(Function.call, Array.prototype.concat);

  if (!Object.values) {
    /**
     * @param {!Object} O
     * @return {!Array}
     */
    Object.values = function values(O) {
      return reduce(Reflect.ownKeys(O), (v, k) => concat(v,
          typeof k === 'string' && isEnumerable(O, k) ? [O[k]] : []), []);
    };
  }

  if (!Object.entries) {
    /**
     * @param {!Object} O
     * @return {!Array<!Array<string>>}
     */
    Object.entries = function entries(O) {
      return reduce(Reflect.ownKeys(O), (e, k) => concat(e,
          typeof k === 'string' && isEnumerable(O, k) ? [[k, O[k]]] : []), []);
    };
  }
};

if (!Object.values || !Object.entries) {
  lib.polyfill.object();
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/finally
 * https://github.com/tc39/proposal-promise-finally/blob/master/polyfill.js
 */
lib.polyfill.promiseFinally = function() {
  /**
   * @param {!Object} O
   * @param {!Function} defaultConstructor
   * @return {!Function}
   */
  const speciesConstructor = function(O, defaultConstructor) {
    if (!O || (typeof O !== 'object' && typeof O !== 'function')) {
      throw new TypeError('Assertion failed: Type(O) is not Object');
    }
    const C = O.constructor;
    if (typeof C === 'undefined') {
      return defaultConstructor;
    }
    if (!C || (typeof C !== 'object' && typeof C !== 'function')) {
      throw new TypeError('O.constructor is not an Object');
    }
    const S =
        typeof Symbol === 'function' && typeof Symbol.species === 'symbol' ?
        C[Symbol.species] : undefined;
    if (S == null) {
      return defaultConstructor;
    }
    if (typeof S === 'function' && S.prototype) {
      return S;
    }
    throw new TypeError('no constructor found');
  };

  /**
   * @param {function()} onFinally
   * @return {!Promise}
   */
  function finallyFn(onFinally) {
    const promise = this;
    if (typeof promise !== 'object' || promise === null) {
      throw new TypeError('"this" value is not an Object');
    }
    const C = speciesConstructor(promise, Promise);
    if (typeof onFinally !== 'function') {
      return Promise.prototype.then.call(promise, onFinally, onFinally);
    }
    return Promise.prototype.then.call(
      promise,
      x => new C(resolve => resolve(onFinally())).then(() => x),
      e => new C(resolve => resolve(onFinally())).then(() => { throw e; })
    );
  }
  Object.defineProperty(Promise.prototype, 'finally', {
    configurable: true, writable: true, value: finallyFn,
  });
};

if (typeof Promise.prototype.finally !== 'function') {
  lib.polyfill.promiseFinally();
}

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
