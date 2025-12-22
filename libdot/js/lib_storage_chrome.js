// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from './lib.js';

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
   * @return {!Promise<void>}
   * @override
   */
  async clear() {
    return new Promise((resolve) => {
      this.storage_.clear(resolve);
    });
  }

  /**
   * @param {?Array<string>} keys
   * @return {!Promise<!Object<string, *>>}
   * @override
   */
  async getItems(keys) {
    return new Promise((resolve) => {
      this.storage_.get(keys, resolve);
    });
  }

  /**
   * @param {string} key
   * @param {*} value
   * @return {!Promise<void>}
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
   * @param {!Object} obj
   * @return {!Promise<void>}
   * @override
   */
  async setItems(obj) {
    return new Promise((resolve) => {
      this.storage_.set(obj, resolve);
    });
  }

  /**
   * @param {!Array<string>} keys
   * @return {!Promise<void>}
   * @override
   */
  async removeItems(keys) {
    return new Promise((resolve) => {
      this.storage_.remove(keys, resolve);
    });
  }
};
