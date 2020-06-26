// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Test suite for Chrome storage.
 */

describe('lib_storage_chrome_tests.js', () => {

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

  /** @override */
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

  /** @override */
  set(items, callback = () => {}) {
    assert.isAtLeast(arguments.length, 1);
    assert.isAtMost(arguments.length, 2);
    assert.equal('function', typeof callback);
    assert.equal('object', typeof items);

    this.update_(Object.assign({}, this.storage_, items));
    setTimeout(callback);
  }

  /** @override */
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

  /** @override */
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

lib.Storage.ApiTest();

});
