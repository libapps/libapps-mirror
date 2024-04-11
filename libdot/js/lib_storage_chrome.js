// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../index.js';

/**
 * chrome.storage based class with an async interface that is interchangeable
 * with other lib.Storage.* implementations.
 */
lib.Storage.Chrome = class extends lib.Storage {
  /**
   * @param {!StorageArea} storage The backing storage.
   */
  constructor(storage) {
    super();

    this.storage_ = storage;
    this.observers_ = [];

    storage.onChanged.addListener(this.onChanged_.bind(this));
  }

  /**
   * Called by the storage implementation when the storage is modified.
   *
   * @param {!Object<string, !StorageChange>} changes Object mapping each key
   *     that changed to its corresponding StorageChange for that item.
   */
  onChanged_(changes) {
    this.observers_.forEach((o) => o(changes));
  }

  /**
   * Register a function to observe storage changes.
   *
   * @param {function(!Object<string, !StorageChange>)} callback The function to
   *     invoke when the storage changes.
   * @override
   */
  addObserver(callback) {
    this.observers_.push(callback);
  }

  /**
   * Unregister a change observer.
   *
   * @param {function(!Object<string, !StorageChange>)} callback A previously
   *     registered callback.
   * @override
   */
  removeObserver(callback) {
    const i = this.observers_.indexOf(callback);
    if (i != -1) {
      this.observers_.splice(i, 1);
    }
  }

  /**
   * Delete everything in this storage.
   *
   * @override
   */
  async clear() {
    return new Promise((resolve) => {
      this.storage_.clear(resolve);
    });
  }

  /**
   * Return the current value of a storage item.
   *
   * @param {string} key The key to look up.
   * @override
   */
  async getItem(key) {
    return this.getItems([key]).then((items) => items[key]);
  }

  /**
   * Fetch the values of multiple storage items.
   *
   * @param {?Array<string>} keys The keys to look up.  Pass null for all keys.
   * @override
   */
  async getItems(keys) {
    return new Promise((resolve) => {
      this.storage_.get(keys, resolve);
    });
  }

  /**
   * Set a value in storage.
   *
   * @param {string} key The key for the value to be stored.
   * @param {*} value The value to be stored.  Anything that can be serialized
   *     with JSON is acceptable.
   * @override
   */
  async setItem(key, value) {
    return new Promise((resolve) => {
      const onComplete = () => {
        const err = lib.f.lastError();
        if (err) {
          // Doesn't seem to be any better way of handling this.
          // https://crbug.com/764759
          if (err.indexOf('MAX_WRITE_OPERATIONS')) {
            console.warn(`Will retry '${key}' save after exceeding quota:`,
                         err);
            setTimeout(() => this.setItem(key, value).then(onComplete), 1000);
            return;
          } else {
            console.error(`Unknown runtime error: ${err}`);
          }
        }

        resolve();
      };

      this.setItems({[key]: value}).then(onComplete);
    });
  }

  /**
   * Set multiple values in storage.
   *
   * @param {!Object} obj A map of key/values to set in storage.
   * @override
   */
  async setItems(obj) {
    return new Promise((resolve) => {
      this.storage_.set(obj, resolve);
    });
  }

  /**
   * Remove an item from storage.
   *
   * @param {string} key The key to be removed.
   * @override
   */
  async removeItem(key) {
    return this.removeItems([key]);
  }

  /**
   * Remove multiple items from storage.
   *
   * @param {!Array<string>} keys The keys to be removed.
   * @override
   */
  async removeItems(keys) {
    return new Promise((resolve) => {
      this.storage_.remove(keys, resolve);
    });
  }
};
