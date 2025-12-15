// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test suite for condenser storage.
 */

import {lib} from '../index.js';
import {storageApiTest} from './lib_storage_test_util.js';

describe('lib_storage_condenser_tests.js', () => {

/**
 * Initialize the storage fakes & APIs.
 */
beforeEach(function() {
  this.backingStorage = new lib.Storage.Memory();
  this.storage = new lib.Storage.Condenser(this.backingStorage, 'key');
  this.storage.syncDelay_ = 0;
});

storageApiTest();

/**
 * Verify writes to backing storage actually uses only one key.
 */
it('backing-storage-write', async function() {
  await this.storage.setItems({
    'a': 1,
    'b': 2,
  });
  // Wait for the backing storage sync to finish.
  await new Promise((resolve) => setTimeout(resolve));
  // Pull out all keys from the backing storage.
  const data = await this.backingStorage.getItems(null);
  assert.deepStrictEqual(Object.keys(data), ['key']);
  const items = JSON.parse(data['key']);
  assert.deepStrictEqual(items, {'a': 1, 'b': 2});
});

/**
 * Verify clears only remove one key from the backing storage.
 */
it('backing-storage-clear', async function() {
  await this.backingStorage.setItem('foo', 'bar');
  await this.storage.setItem('a', 1);
  // Wait for the backing storage sync to finish.
  await new Promise((resolve) => setTimeout(resolve));
  // Pull out all keys from the backing storage.
  let data = await this.backingStorage.getItems(null);
  assert.deepStrictEqual(Object.keys(data), ['foo', 'key']);
  // Clear should only affect our registered key.
  await this.storage.clear();
  await new Promise((resolve) => setTimeout(resolve));
  data = await this.backingStorage.getItems(null);
  assert.deepStrictEqual(Object.keys(data), ['foo']);
});

});
