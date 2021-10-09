// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * chrome.storage based class with an async interface that is interchangeable
 * with other lib.Storage.* implementations.
 *
 * @param {!StorageArea} storage The backing storage.
 * @implements {lib.Storage}
 * @constructor
 */
lib.Storage.Chrome = function(storage) {
  this.storage_ = storage;
  this.observers_ = [];

  storage.onChanged.addListener(this.onChanged_.bind(this));
};

/**
 * Called by the storage implementation when the storage is modified.
 *
 * @param {!Object<string, !StorageChange>} changes Object mapping each key that
 *     changed to its corresponding StorageChange for that item.
 */
lib.Storage.Chrome.prototype.onChanged_ = function(changes) {
  this.observers_.forEach((o) => o(changes));
};

/**
 * Register a function to observe storage changes.
 *
 * @param {function(!Object<string, !StorageChange>)} callback The function to
 *     invoke when the storage changes.
 * @override
 */
lib.Storage.Chrome.prototype.addObserver = function(callback) {
  this.observers_.push(callback);
};

/**
 * Unregister a change observer.
 *
 * @param {function(!Object<string, !StorageChange>)} callback A previously
 *     registered callback.
 * @override
 */
lib.Storage.Chrome.prototype.removeObserver = function(callback) {
  const i = this.observers_.indexOf(callback);
  if (i != -1) {
    this.observers_.splice(i, 1);
  }
};

/**
 * Delete everything in this storage.
 *
 * @override
 */
lib.Storage.Chrome.prototype.clear = async function() {
  return new Promise((resolve) => {
    this.storage_.clear(resolve);
  });
};

/**
 * Return the current value of a storage item.
 *
 * @param {string} key The key to look up.
 * @override
 */
lib.Storage.Chrome.prototype.getItem = async function(key) {
  return this.getItems([key]).then((items) => items[key]);
};

/**
 * Fetch the values of multiple storage items.
 *
 * @param {?Array<string>} keys The keys to look up.  Pass null for all keys.
 * @override
 */
lib.Storage.Chrome.prototype.getItems = async function(keys) {
  return new Promise((resolve) => {
    this.storage_.get(keys, resolve);
  });
};

/**
 * Set a value in storage.
 *
 * @param {string} key The key for the value to be stored.
 * @param {*} value The value to be stored.  Anything that can be serialized
 *     with JSON is acceptable.
 * @override
 */
lib.Storage.Chrome.prototype.setItem = async function(key, value) {
  return new Promise((resolve) => {
    const onComplete = () => {
      const err = lib.f.lastError();
      if (err) {
        // Doesn't seem to be any better way of handling this.
        // https://crbug.com/764759
        if (err.indexOf('MAX_WRITE_OPERATIONS')) {
          console.warn(`Will retry '${key}' save after exceeding quota:`, err);
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
};

/**
 * Set multiple values in storage.
 *
 * @param {!Object} obj A map of key/values to set in storage.
 * @override
 */
lib.Storage.Chrome.prototype.setItems = async function(obj) {
  return new Promise((resolve) => {
    this.storage_.set(obj, resolve);
  });
};

/**
 * Remove an item from storage.
 *
 * @param {string} key The key to be removed.
 * @override
 */
lib.Storage.Chrome.prototype.removeItem = async function(key) {
  return this.removeItems([key]);
};

/**
 * Remove multiple items from storage.
 *
 * @param {!Array<string>} keys The keys to be removed.
 * @override
 */
lib.Storage.Chrome.prototype.removeItems = async function(keys) {
  return new Promise((resolve) => {
    this.storage_.remove(keys, resolve);
  });
};
