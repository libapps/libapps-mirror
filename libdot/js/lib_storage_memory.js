// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../index.js';

/**
 * In-memory storage class with an async interface that is interchangeable with
 * other lib.Storage.* implementations.
 */
lib.Storage.Memory = class extends lib.Storage {
  constructor() {
    super();

    this.storage_ = {};
  }

  /**
   * Update the internal storage state and generate change events for it.
   *
   * @param {!Object<string, *>} newStorage
   */
  async update_(newStorage) {
    const changes = lib.Storage.generateStorageChanges(
        this.storage_, newStorage);
    this.storage_ = newStorage;

    // Force deferment for the standard API.
    await 0;

    // Don't bother notifying if there are no changes.
    if (Object.keys(changes).length) {
      this.observers_.forEach((o) => o(changes));
    }
  }

  /**
   * Delete everything in this storage.
   *
   * @override
   */
  async clear() {
    return this.update_({});
  }

  /**
   * Fetch the values of multiple storage items.
   *
   * @param {?Array<string>} keys The keys to look up.  Pass null for all keys.
   * @override
   */
  async getItems(keys) {
    const rv = {};
    if (!keys) {
      keys = Object.keys(this.storage_);
    }

    keys.forEach((key) => {
      if (this.storage_.hasOwnProperty(key)) {
        rv[key] = this.storage_[key];
      }
    });

    // Force deferment for the standard API.
    await 0;

    return rv;
  }

  /**
   * Set multiple values in storage.
   *
   * @param {!Object} obj A map of key/values to set in storage.
   * @override
   */
  async setItems(obj) {
    const newStorage = Object.assign({}, this.storage_);
    for (const key in obj) {
      // Normalize through JSON to mimic Local/Chrome backends.
      newStorage[key] = JSON.parse(JSON.stringify(obj[key]));
    }
    return this.update_(newStorage);
  }

  /**
   * Remove multiple items from storage.
   *
   * @param {!Array<string>} keys The keys to be removed.
   * @override
   */
  async removeItems(keys) {
    const newStorage = Object.assign({}, this.storage_);
    keys.forEach((key) => delete newStorage[key]);
    return this.update_(newStorage);
  }
};
