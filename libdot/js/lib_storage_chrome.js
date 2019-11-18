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

  chrome.storage.onChanged.addListener(this.onChanged_.bind(this));
};

/**
 * Called by the storage implementation when the storage is modified.
 *
 * @param {!Array<*>} changes Object mapping each key that changed to its
 *     corresponding storage.StorageChange for that item.
 * @param {string} areaname The name of the storage area ("sync", "local",
 *     or "managed") the changes are for.
 */
lib.Storage.Chrome.prototype.onChanged_ = function(changes, areaname) {
  if (chrome.storage[areaname] != this.storage_)
    return;

  for (var i = 0; i < this.observers_.length; i++) {
    this.observers_[i](changes);
  }
};

/**
 * Register a function to observe storage changes.
 *
 * @param {function(!Object)} callback The function to invoke when the storage
 *     changes.
 * @override
 */
lib.Storage.Chrome.prototype.addObserver = function(callback) {
  this.observers_.push(callback);
};

/**
 * Unregister a change observer.
 *
 * @param {function(!Object)} callback A previously registered callback.
 * @override
 */
lib.Storage.Chrome.prototype.removeObserver = function(callback) {
  var i = this.observers_.indexOf(callback);
  if (i != -1)
    this.observers_.splice(i, 1);
};

/**
 * Delete everything in this storage.
 *
 * @param {function()=} callback The function to invoke when the delete has
 *     completed.
 * @override
 */
lib.Storage.Chrome.prototype.clear = function(callback) {
  this.storage_.clear();

  if (callback) {
    setTimeout(callback, 0);
  }
};

/**
 * Return the current value of a storage item.
 *
 * @param {string} key The key to look up.
 * @param {function(*)} callback The function to invoke when the value has
 *     been retrieved.
 * @override
 */
lib.Storage.Chrome.prototype.getItem = function(key, callback) {
  this.storage_.get(key, callback);
};

/**
 * Fetch the values of multiple storage items.
 *
 * @param {?Array<string>} keys The keys to look up.  Pass null for all keys.
 * @param {function(!Object)} callback The function to invoke when the values
 *     have been retrieved.
 * @override
 */
lib.Storage.Chrome.prototype.getItems = function(keys, callback) {
  this.storage_.get(keys, callback);
};

/**
 * Set a value in storage.
 *
 * @param {string} key The key for the value to be stored.
 * @param {*} value The value to be stored.  Anything that can be serialized
 *     with JSON is acceptable.
 * @param {function()=} callback Function to invoke when the set is complete.
 *     You don't have to wait for the set to complete in order to read the
 *     value since the local cache is updated synchronously.
 * @override
 */
lib.Storage.Chrome.prototype.setItem = function(key, value, callback) {
  const onComplete = () => {
    const err = lib.f.lastError();
    if (err) {
      // Doesn't seem to be any better way of handling this.
      // https://crbug.com/764759
      if (err.indexOf('MAX_WRITE_OPERATIONS')) {
        console.warn(`Will retry save of ${key} after exceeding quota: ${err}`);
        setTimeout(() => this.setItem(key, value, onComplete), 1000);
        return;
      } else {
        console.error(`Unknown runtime error: ${err}`);
      }
    }

    if (callback) {
      callback();
    }
  };

  var obj = {};
  obj[key] = value;
  this.storage_.set(obj, onComplete);
};

/**
 * Set multiple values in storage.
 *
 * @param {!Object} obj A map of key/values to set in storage.
 * @param {function()=} callback Function to invoke when the set is complete.
 *     You don't have to wait for the set to complete in order to read the
 *     value since the local cache is updated synchronously.
 * @override
 */
lib.Storage.Chrome.prototype.setItems = function(obj, callback) {
  this.storage_.set(obj, callback);
};

/**
 * Remove an item from storage.
 *
 * @param {string} key The key to be removed.
 * @param {function()=} callback Function to invoke when the remove is complete.
 *     You don't have to wait for the set to complete in order to read the value
 *     since the local cache is updated synchronously.
 * @override
 */
lib.Storage.Chrome.prototype.removeItem = function(key, callback) {
  this.storage_.remove(key, callback);
};

/**
 * Remove multiple items from storage.
 *
 * @param {!Array<string>} keys The keys to be removed.
 * @param {function()=} callback Function to invoke when the remove is complete.
 *     You don't have to wait for the set to complete in order to read the value
 *     since the local cache is updated synchronously.
 * @override
 */
lib.Storage.Chrome.prototype.removeItems = function(keys, callback) {
  this.storage_.remove(keys, callback);
};
