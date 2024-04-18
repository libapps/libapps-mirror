// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../index.js';

/**
 * A wrapper for other storage classes to condense many keys into one.
 */
lib.Storage.Condenser = class extends lib.Storage {
  /**
   * @param {!lib.Storage} storage The backing storage.
   * @param {string} key The key to use for storing everything.
   */
  constructor(storage, key) {
    super();

    /** @type {?Promise<void>} */
    this.cacheSyncing_ = null;

    this.storage_ = storage;
    /** @const {string} */
    this.key_ = key;
    /** @const */
    this.memStorage_ = new lib.Storage.Memory();
    /** @type {?number} */
    this.syncCallback_ = null;
    /** @type {number} Delay (in msec) before we write to storage. */
    this.syncDelay_ = 500;
  }

  /**
   * Load the settings into our local cache once.
   *
   * This caches the promise from initCache__ so multiple callers can await it.
   */
  async initCache_() {
    if (this.cacheSyncing_ === null) {
      this.cacheSyncing_ = this.initCache__();
    }

    await this.cacheSyncing_;
  }

  /**
   * Load the settings into our local cache.
   */
  async initCache__() {
    let data = await this.storage_.getItem(this.key_);
    if (data === undefined) {
      // Key doesn't exist.
      return;
    }

    // Try and parse it.  If we fail, throw it away.
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        data = null;
      }
    } else {
      data = null;
    }
    if (typeof data !== 'object' || data === null) {
      await this.storage_.removeItem(this.key_);
      return;
    }

    await this.memStorage_.clear();
    await this.memStorage_.setItems(data);
  }

  /**
   * Queue a sync to the backing storage.
   *
   * We coalesce multiple updates into a single write.
   */
  queueWriteSync_() {
    this.cancelWriteSync_();
    this.syncCallback_ = setTimeout(async () => {
      await this.storage_.setItem(
          this.key_,
          JSON.stringify(await this.memStorage_.getItems(null)),
      );
      this.syncCallback_ = null;
    }, this.syncDelay_);
  }

  /**
   * Cancel any pending sync calls.
   */
  cancelWriteSync_() {
    if (this.syncCallback_ !== null) {
      clearTimeout(this.syncCallback_);
    }
    this.syncCallback_ = null;
  }

  /**
   * Register a function to observe storage changes.
   *
   * @param {function(!Object<string, !StorageChange>)} callback The function to
   *     invoke when the storage changes.
   * @override
   */
  addObserver(callback) {
    this.memStorage_.addObserver(callback);
  }

  /**
   * Unregister a change observer.
   *
   * @param {function(!Object<string, !StorageChange>)} callback A previously
   *     registered callback.
   * @override
   */
  removeObserver(callback) {
    this.memStorage_.removeObserver(callback);
  }

  /**
   * Delete everything in this storage.
   *
   * @override
   */
  async clear() {
    this.cancelWriteSync_();

    await Promise.all([
      this.storage_.removeItem(this.key_),
      this.memStorage_.clear(),
    ]);
  }

  /**
   * Fetch the values of multiple storage items.
   *
   * @param {?Array<string>} keys The keys to look up.  Pass null for all keys.
   * @override
   */
  async getItems(keys) {
    await this.initCache_();
    return this.memStorage_.getItems(keys);
  }

  /**
   * Set multiple values in storage.
   *
   * @param {!Object} obj A map of key/values to set in storage.
   * @override
   */
  async setItems(obj) {
    await this.initCache_();
    await this.memStorage_.setItems(obj);
    this.queueWriteSync_();
  }

  /**
   * Remove multiple items from storage.
   *
   * @param {!Array<string>} keys The keys to be removed.
   * @override
   */
  async removeItems(keys) {
    await this.initCache_();
    await this.memStorage_.removeItems(keys);
    this.queueWriteSync_();
  }
};
