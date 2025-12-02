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
   * @return {!Promise<void>}
   * @override
   */
  async clear() {
    this.storage_.clear();

    // Force deferment for the standard API.
    await 0;
  }

  /**
   * @param {?Array<string>} keys
   * @return {!Promise<!Object<string, *>>}
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
   * @param {!Object} obj
   * @return {!Promise<void>}
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
   * @param {!Array<string>} keys
   * @return {!Promise<void>}
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
