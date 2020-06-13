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

it('Blob.arrayBuffer', async () => {
  const blob = new Blob(['ab12']);
  const exp = new Uint8Array([97, 98, 49, 50]);
  let ret;

  // Make sure polyfill matches standards behavior in newer browser.
  // This might be our own stub in older browsers :).
  if (blob.arrayBuffer !== undefined) {
    ret = await blob.arrayBuffer();
    assert.deepStrictEqual(exp, new Uint8Array(ret));
  }

  // Force bind in our polyfill & test it.
  blob.arrayBuffer = lib.polyfill.BlobArrayBuffer.bind(blob);
  ret = await blob.arrayBuffer();
  assert.deepStrictEqual(exp, new Uint8Array(ret));
});

it('Blob.text', async () => {
  const exp = 'ab12';
  const blob = new Blob([exp]);
  let ret;

  // Make sure polyfill matches standards behavior in newer browser.
  // This might be our own stub in older browsers :).
  if (blob.text !== undefined) {
    ret = await blob.text();
    assert.deepStrictEqual(exp, ret);
  }

  // Force bind in our polyfill & test it.
  blob.text = lib.polyfill.BlobText.bind(blob);
  ret = await blob.text();
  assert.deepStrictEqual(exp, ret);
});

});
