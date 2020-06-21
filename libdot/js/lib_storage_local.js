// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * window.localStorage based class with an async interface that is
 * interchangeable with other lib.Storage.* implementations.
 *
 * @param {!Storage=} storage The backing storage.
 * @implements {lib.Storage}
 * @constructor
 */
lib.Storage.Local = function(storage = undefined) {
  this.observers_ = [];
  /** @type {!Storage} */
  this.storage_ = storage ? storage : lib.notNull(window.localStorage);
  // Closure thinks all addEventListener calls take Events.
  window.addEventListener(
      'storage',
      /** @type {function(!Event)} */ (this.onStorage_.bind(this)));
};

/**
 * Called by the storage implementation when the storage is modified.
 *
 * @param {!StorageEvent} e The setting that has changed.
 */
lib.Storage.Local.prototype.onStorage_ = function(e) {
  if (e.storageArea != this.storage_) {
    return;
  }

  // JS throws an exception if JSON.parse is given an empty string. So here we
  // only parse if the value is truthy. This mean the empty string, undefined
  // and null will not be parsed.
  const prevValue = e.oldValue ? JSON.parse(e.oldValue) : e.oldValue;
  const curValue = e.newValue ? JSON.parse(e.newValue) : e.newValue;
  const o = {};
  o[e.key] = {
    oldValue: prevValue,
    newValue: curValue,
  };

  for (let i = 0; i < this.observers_.length; i++) {
    this.observers_[i](o);
  }
};

/**
 * Register a function to observe storage changes.
 *
 * @param {function(!Object)} callback The function to invoke when the storage
 *     changes.
 * @override
 */
lib.Storage.Local.prototype.addObserver = function(callback) {
  this.observers_.push(callback);
};

/**
 * Unregister a change observer.
 *
 * @param {function(!Object)} callback A previously registered callback.
 * @override
 */
lib.Storage.Local.prototype.removeObserver = function(callback) {
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
lib.Storage.Local.prototype.clear = async function() {
  this.storage_.clear();

  // Force deferment for the standard API.
  await 0;
};

/**
 * Return the current value of a storage item.
 *
 * @param {string} key The key to look up.
 * @param {function(*)} callback The function to invoke when the value has
 *     been retrieved.
 * @override
 */
lib.Storage.Local.prototype.getItem = function(key, callback) {
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
lib.Storage.Local.prototype.getItems = function(keys, callback) {
  const rv = {};
  if (!keys) {
    keys = [];
    for (let i = 0; i < this.storage_.length; i++) {
      keys.push(this.storage_.key(i));
    }
  }

  for (let i = keys.length - 1; i >= 0; i--) {
    const key = keys[i];
    const value = this.storage_.getItem(key);
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
lib.Storage.Local.prototype.setItem = function(key, value, callback) {
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
lib.Storage.Local.prototype.setItems = function(obj, callback) {
  for (const key in obj) {
    this.storage_.setItem(key, JSON.stringify(obj[key]));
  }

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
lib.Storage.Local.prototype.removeItem = async function(key) {
  return this.removeItems([key]);
};

/**
 * Remove multiple items from storage.
 *
 * @param {!Array<string>} keys The keys to be removed.
 * @override
 */
lib.Storage.Local.prototype.removeItems = async function(keys) {
  for (let i = 0; i < keys.length; i++) {
    this.storage_.removeItem(keys[i]);
  }

  // Force deferment for the standard API.
  await 0;
};
