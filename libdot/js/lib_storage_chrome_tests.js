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
    this.storage_ = {};

    /**
     * @type {!ChromeEvent}
     * @suppress {checkTypes} The mock is not an exact match.
     */
    this.onChanged = {
      addListener: () => {},
    };
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
        if (this.storage_[key] !== undefined) {
          values[key] = this.storage_[key];
        }
      });
    } else {
      for (const [key, defaultValue] of Object.entries(this.storage_)) {
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

    Object.assign(this.storage_, items);
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
    keys.forEach((key) => delete this.storage_[key]);
    setTimeout(callback);
  }

  /** @override */
  clear(callback = () => {}) {
    assert.isAtMost(arguments.length, 1);
    assert.equal('function', typeof callback);

    this.storage_ = {};
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
