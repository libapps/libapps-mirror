// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Unit tests for lib_polyfill.js.
 */

describe('lib_polyfill_tests.js', () => {
  /**
   * @param {!Object} obj Object with property to capture and delete.
   * @param {string} prop Property to capture and delete.
   * @param {function()} polyfill function.
   * @param {function()} test function.
   */
  async function polyfillTest(obj, prop, polyfill, test) {
    // Run the test in the original environment.
    assert.isDefined(obj[prop]);
    await test();

    // Capture and delete obj.prop.
    const original = obj[prop];
    delete obj[prop];
    assert.isUndefined(obj[prop]);

    // Load polyfill again to do its job, and run tests.
    polyfill();
    await test();

    // Restore.
    obj[prop] = original;
  }

it('polyfills-string-pad-start', async () => {
  function test() { assert.equal('23'.padStart(7, '01'), '0101023'); }
  await polyfillTest(
      String.prototype, 'padStart', lib.polyfill.stringPadStart, test);
});

it('polyfills-string-pad-end', async () => {
  function test() { assert.equal('23'.padEnd(7, '01'), '2301010'); }
  await polyfillTest(
      String.prototype, 'padEnd', lib.polyfill.stringPadEnd, test);
});

it('polyfills-object-values', async () => {
  function test() { assert.deepEqual(Object.values({a: 1, b: 2}), [1, 2]); }
  await polyfillTest(Object, 'values', lib.polyfill.object, test);
});

it('polyfills-object-entries', async () => {
  function test() {
    assert.deepEqual(Object.entries({a: 1, b: 2}), [['a', 1], ['b', 2]]);
  }
  await polyfillTest(Object, 'values', lib.polyfill.object, test);
});

it('polyfills-promise-finally', async () => {
  async function test() {
    const stack = [];
    const result = await new Promise((resolve, reject) => {
      stack.push('constructor');
      resolve('constructor');
    })
    .then((p) => {
      stack.push(p, 'then1');
      return 'then1';
    })
    .then((p) => {
      stack.push(p, 'then2');
      throw 'then2error';
    })
    .then((p) => {
      stack.push(p, 'then3');
      return 'then3';
    })
    .catch((p) => {
      stack.push(p, 'catch');
      return 'catch';
    })
    .finally(function() {
      stack.push(arguments[0], 'finally');
      return 'finally';
    }).then((p) => {
      stack.push(p, 'then4');
      return 'then4';
    });
    assert.equal('then4', result);
    assert.deepEqual(stack, [
        'constructor',
        'constructor', 'then1',
        'then1', 'then2',
        'then2error', 'catch',
        undefined, 'finally',
        'catch', 'then4']);
  }
  await polyfillTest(
      Promise.prototype, 'finally', lib.polyfill.promiseFinally, test);
});

});
