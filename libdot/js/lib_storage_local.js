// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../index.js';

/**
 * window.localStorage based class with an async interface that is
 * interchangeable with other lib.Storage.* implementations.
 */
lib.Storage.Local = class extends lib.Storage {
  /**
   * @param {!Storage=} storage The backing storage.
   */
  constructor(storage = undefined) {
    super();

    this.observers_ = [];
    /** @type {!Storage} */
    this.storage_ = storage ? storage : lib.notNull(globalThis.localStorage);
    // Closure thinks all addEventListener calls take Events.
    globalThis.addEventListener(
        'storage',
        /** @type {function(!Event)} */ (this.onStorage_.bind(this)));
  }

  /**
   * Called by the storage implementation when the storage is modified.
   *
   * @param {!StorageEvent} e The setting that has changed.
   */
  onStorage_(e) {
    if (e.storageArea != this.storage_) {
      return;
    }

    const o = {};
    o[e.key] = {
      oldValue: parseJson_(e.oldValue),
      newValue: parseJson_(e.newValue),
    };

    for (let i = 0; i < this.observers_.length; i++) {
      this.observers_[i](o);
    }
  }

  /**
   * Register a function to observe storage changes.
   *
   * @param {function(!Object)} callback The function to invoke when the storage
   *     changes.
   * @override
   */
  addObserver(callback) {
    this.observers_.push(callback);
  }

  /**
   * Unregister a change observer.
   *
   * @param {function(!Object)} callback A previously registered callback.
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
    this.storage_.clear();

    // Force deferment for the standard API.
    await 0;
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
      keys = [];
      for (let i = 0; i < this.storage_.length; i++) {
        keys.push(this.storage_.key(i));
      }
    }

    for (const key of keys) {
      const value = this.storage_.getItem(key);
      if (typeof value == 'string') {
        rv[key] = parseJson_(value);
      }
    }

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
    for (const key in obj) {
      this.storage_.setItem(key, JSON.stringify(obj[key]));
    }

    // Force deferment for the standard API.
    await 0;
  }

  /**
   * Remove multiple items from storage.
   *
   * @param {!Array<string>} keys The keys to be removed.
   * @override
   */
  async removeItems(keys) {
    for (let i = 0; i < keys.length; i++) {
      this.storage_.removeItem(keys[i]);
    }

    // Force deferment for the standard API.
    await 0;
  }
};

/**
 * Returns parsed JSON, or original value if JSON.parse fails.
 *
 * @param {?string} jsonString The string to parse.
 * @return {*}
 */
function parseJson_(jsonString) {
  if (jsonString !== null) {
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      // Ignore and return jsonString.
    }
  }
  return jsonString;
}
