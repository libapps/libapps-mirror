// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * In-memory storage class with an async interface that is interchangeable with
 * other lib.Storage.* implementations.
 *
 * @constructor
 * @implements {lib.Storage}
 */
lib.Storage.Memory = function() {
  this.observers_ = [];
  this.storage_ = {};
};

/**
 * Register a function to observe storage changes.
 *
 * @param {function(!Object)} callback The function to invoke when the storage
 *     changes.
 * @override
 */
lib.Storage.Memory.prototype.addObserver = function(callback) {
  this.observers_.push(callback);
};

/**
 * Unregister a change observer.
 *
 * @param {function(!Object)} callback A previously registered callback.
 * @override
 */
lib.Storage.Memory.prototype.removeObserver = function(callback) {
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
lib.Storage.Memory.prototype.clear = async function() {
  const e = {};
  for (const key in this.storage_) {
    e[key] = {oldValue: this.storage_[key], newValue: undefined};
  }

  this.storage_ = {};

  // Force deferment for the standard API.
  await 0;

  this.observers_.forEach((o) => o(e));
};

/**
 * Return the current value of a storage item.
 *
 * @param {string} key The key to look up.
 * @param {function(*)} callback The function to invoke when the value has
 *     been retrieved.
 * @override
 */
lib.Storage.Memory.prototype.getItem = function(key, callback) {
  this.getItems([key], (items) => callback(items[key]));
};

/**
 * Fetch the values of multiple storage items.
 *
 * @param {?Array<string>} keys The keys to look up.  Pass null for all keys.
 * @param {function(!Object)} callback The function to invoke when the values
 *     have been retrieved.
 * @override
 */
lib.Storage.Memory.prototype.getItems = function(keys, callback) {
  const rv = {};
  if (!keys) {
    keys = Object.keys(this.storage_);
  }

  for (let i = keys.length - 1; i >= 0; i--) {
    const key = keys[i];
    const value = this.storage_[key];
    if (typeof value == 'string') {
      try {
        rv[key] = JSON.parse(value);
      } catch (e) {
        // If we can't parse the value, just return it unparsed.
        rv[key] = value;
      }
    } else {
      keys.splice(i, 1);
    }
  }

  setTimeout(callback.bind(null, rv), 0);
};

/**
 * Set a value in storage.
 *
 * @param {string} key The key for the value to be stored.
 * @param {*} value The value to be stored.  Anything that can be serialized
 *     with JSON is acceptable.
 * @param {function()=} callback Function to invoke when the set is complete.
 *     You don't have to wait for the set to complete in order to read the value
 *     since the local cache is updated synchronously.
 * @override
 */
lib.Storage.Memory.prototype.setItem = function(key, value, callback) {
  this.setItems({[key]: value}, callback);
};

/**
 * Set multiple values in storage.
 *
 * @param {!Object} obj A map of key/values to set in storage.
 * @param {function()=} callback Function to invoke when the set is complete.
 *     You don't have to wait for the set to complete in order to read the value
 *     since the local cache is updated synchronously.
 * @override
 */
lib.Storage.Memory.prototype.setItems = function(obj, callback) {
  const e = {};

  for (const key in obj) {
    e[key] = {oldValue: this.storage_[key], newValue: obj[key]};
    this.storage_[key] = JSON.stringify(obj[key]);
  }

  setTimeout(function() {
    for (let i = 0; i < this.observers_.length; i++) {
      this.observers_[i](e);
    }
  }.bind(this));

  if (callback) {
    setTimeout(callback, 0);
  }
};

/**
 * Remove an item from storage.
 *
 * @param {string} key The key to be removed.
 * @override
 */
lib.Storage.Memory.prototype.removeItem = async function(key) {
  return this.removeItems([key]);
};

/**
 * Remove multiple items from storage.
 *
 * @param {!Array<string>} keys The keys to be removed.
 * @override
 */
lib.Storage.Memory.prototype.removeItems = async function(keys) {
  for (let i = 0; i < keys.length; i++) {
    delete this.storage_[keys[i]];
  }

  // Force deferment for the standard API.
  await 0;
};
