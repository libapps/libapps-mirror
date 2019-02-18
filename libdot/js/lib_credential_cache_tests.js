// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Test suite for the session-local, encrypted cache.
 */

lib.CredentialCache.Tests = new lib.TestManager.Suite('lib.CredentialCache');

/**
 * Verify that the cache remains enabled after being enabled once.
 */
lib.CredentialCache.Tests.addTest('enabled', function(result, cx) {
  const cache = new lib.CredentialCache();
  assert.isNull(cache.isEnabled());
  cache.setEnabled(true);
  assert.isTrue(cache.isEnabled());
  cache.setEnabled(false);
  assert.isTrue(cache.isEnabled());
  cache.setEnabled(null);
  assert.isTrue(cache.isEnabled());

  result.pass();
});

/**
 * Verify that the cache remains disabled after being disabled once.
 */
lib.CredentialCache.Tests.addTest('disabled', function(result, cx) {
  const cache = new lib.CredentialCache();
  assert.isNull(cache.isEnabled());
  cache.setEnabled(false);
  assert.isFalse(cache.isEnabled());
  cache.setEnabled(true);
  assert.isFalse(cache.isEnabled());
  cache.setEnabled(null);
  assert.isFalse(cache.isEnabled());

  result.pass();
});

/**
 * Simulate and verify a typical workflow consisting of store and retrieve
 * operations.
 */
lib.CredentialCache.Tests.addTest('workflow', async function(
    result, cx) {
  result.requestTime(1000);

  const cache = new lib.CredentialCache();
  const keyId1 = 'AABBCCDDEEFF';
  const keyId2 = 'FFEEDDCCBBAA';
  await cache.store('reader_1' + keyId1, new Uint8Array([1, 2, 4, 8]));
  assert.deepStrictEqual(await cache.retrieve('foobar_1' + keyId1), null);
  assert.deepStrictEqual(await cache.retrieve('reader_1' + keyId2), null);
  assert.deepStrictEqual(
      Array.from(await cache.retrieve('reader_1' + keyId1)),
      [1, 2, 4, 8]);
  assert.deepStrictEqual(await cache.retrieve('reader_1' + keyId1), null);
  await cache.store('reader_2' + keyId1, new Uint8Array([1, 3, 9, 27]));
  await cache.store('reader_1' + keyId2, new Uint8Array([1, 5, 25]));
  await cache.store('reader_1' + keyId2, new Uint8Array([1, 7]));
  assert.deepStrictEqual(
      Array.from(await cache.retrieve('reader_1' + keyId2)), [1, 7]);
  assert.deepStrictEqual(await cache.retrieve('reader_1' + keyId2), null);
  await cache.store('reader_1' + keyId2, new Uint8Array([1, 5, 25]));
  assert.deepStrictEqual(
      Array.from(await cache.retrieve('reader_1' + keyId2)), [1, 5, 25]);

  result.pass();
});
