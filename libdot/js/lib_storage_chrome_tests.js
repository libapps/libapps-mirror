// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test suite for Chrome storage.
 */

import {lib} from '../index.js';
import {storageApiTest} from './lib_storage_test_util.js';

/**
 * Fake for Chrome storage APIs.
 *
 * @extends {StorageArea}
 */
class StorageAreaFake {
  constructor() {
    /** @private {!Object<string, *>} */
    this.storage_ = {};

    /** @const @private {!Array<function(!Object)>} */
    this.listeners_ = [];

    // Whether to throw quota write error.
    this.quotaWriteError = false;

    /**
     * @type {!ChromeEvent}
     * @suppress {checkTypes} The mock is not an exact match.
     */
    this.onChanged = {
      addListener: (listener) => this.listeners_.push(listener),
    };
  }

  /**
   * Update the storage & generate any change events.
   *
   * @param {!Object} newStorage
   */
  update_(newStorage) {
    const changes = lib.Storage.generateStorageChanges(
        this.storage_, newStorage);
    this.listeners_.forEach((listener) => listener(changes));
    this.storage_ = newStorage;
  }

  /**
   * Raise a quota write error if requested.
   */
  maybeFakeQuotaWriteError_() {
    if (this.quotaWriteError) {
      this.quotaWriteError = false;
      // NB: This string matches what Chrome throws, and what our code checks.
      throw new Error(
          'This request exceeds the MAX_WRITE_OPERATIONS_PER_MINUTE quota.');
    }
  }

  /**
   * @param {string|?Object=} keys
   * @return {!Promise<!Object<string, *>>}
   * @override
   */
  async get(keys) {
    assert.equal(arguments.length, 1);

    const values = {};

    if (typeof keys === 'string') {
      keys = [keys];
    }

    if (Array.isArray(keys)) {
      keys.forEach((key) => {
        assert.typeOf(key, 'string');
        if (this.storage_[key] !== undefined) {
          values[key] = this.storage_[key];
        }
      });
    } else {
      for (const [key, defaultValue] of Object.entries(this.storage_)) {
        assert.typeOf(key, 'string');
        // This is for closure-compiler as it can't handle the typeOf above.
        assert(typeof key === 'string');
        const value = this.storage_[key];
        values[key] = value === undefined ? defaultValue : value;
      }
    }

    return values;
  }

  /**
   * @param {!Object<string>} items
   * @return {!Promise<void>}
   * @override
   */
  async set(items) {
    assert.equal(arguments.length, 1);
    assert.equal('object', typeof items);

    this.maybeFakeQuotaWriteError_();

    this.update_(Object.assign({}, this.storage_, items));
  }

  /**
   * @param {string|?Object} keys
   * @return {!Promise<void>}
   * @override
   */
  async remove(keys) {
    assert.equal(arguments.length, 1);

    if (!Array.isArray(keys)) {
      keys = [keys];
    }
    const newStorage = Object.assign({}, this.storage_);
    keys.forEach((key) => delete newStorage[key]);
    this.update_(newStorage);
  }

  /**
   * @return {!Promise<void>}
   * @override
   */
  async clear() {
    assert.equal(arguments.length, 0);

    this.update_({});
  }
}

/**
 * Initialize the storage fakes & APIs.
 */
beforeEach(function() {
  this.fake = new StorageAreaFake();
  this.storage = new lib.Storage.Chrome(this.fake);
  this.storage.quotaRetryDelay_ = 0;
});

storageApiTest();

/**
 * Verify setItem quota writes are retried.
 */
it('quota-write-retry setItem', async function() {
  await this.storage.setItem('foo', 1);
  assert.equal(await this.storage.getItem('foo'), 1);

  this.fake.quotaWriteError = true;
  await this.storage.setItem('foo', 2);
  assert.isFalse(this.fake.quotaWriteError);
  assert.equal(await this.storage.getItem('foo'), 2);
});

/**
 * Verify setItems quota writes are retried.
 */
it('quota-write-retry setItems', async function() {
  await this.storage.setItem('foo', 1);
  assert.equal(await this.storage.getItem('foo'), 1);

  this.fake.quotaWriteError = true;
  await this.storage.setItems({'foo': 3});
  assert.isFalse(this.fake.quotaWriteError);
  assert.equal(await this.storage.getItem('foo'), 3);
});
