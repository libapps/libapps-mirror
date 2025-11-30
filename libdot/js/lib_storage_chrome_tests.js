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
   * @param {string|?Object=} keys
   * @param {function(!Object)=} callback
   * @override
   */
  get(keys, callback) {
    assert.equal(arguments.length, 2);
    assert.equal('function', typeof callback);

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
        lib.assert(typeof key === 'string');
        const value = this.storage_[key];
        values[key] = value === undefined ? defaultValue : value;
      }
    }

    setTimeout(() => callback(values));
  }

  /**
   * @param {!Object<string>} items
   * @param {function(!Object)=} callback
   * @override
   */
  set(items, callback = () => {}) {
    assert.isAtLeast(arguments.length, 1);
    assert.isAtMost(arguments.length, 2);
    assert.equal('function', typeof callback);
    assert.equal('object', typeof items);

    this.update_(Object.assign({}, this.storage_, items));
    setTimeout(callback);
  }

  /**
   * @param {string|?Object} keys
   * @param {function(!Object)=} callback
   * @override
   */
  remove(keys, callback = () => {}) {
    assert.isAtLeast(arguments.length, 1);
    assert.isAtMost(arguments.length, 2);
    assert.equal('function', typeof callback);

    if (!Array.isArray(keys)) {
      keys = [keys];
    }
    const newStorage = Object.assign({}, this.storage_);
    keys.forEach((key) => delete newStorage[key]);
    this.update_(newStorage);
    setTimeout(callback);
  }

  /**
   * @param {function(!Object)=} callback
   * @override
   */
  clear(callback = () => {}) {
    assert.isAtMost(arguments.length, 1);
    assert.equal('function', typeof callback);

    this.update_({});
    setTimeout(callback);
  }
}

/**
 * Initialize the storage fakes & APIs.
 */
beforeEach(function() {
  const fake = new StorageAreaFake();
  this.storage = new lib.Storage.Chrome(fake);
});

storageApiTest();
