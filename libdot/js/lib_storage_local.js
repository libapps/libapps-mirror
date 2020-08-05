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
 * Returns parsed JSON, or original value if JSON.parse fails.
 *
 * @param {?string} jsonString The string to parse.
 * @return {*}
 */
lib.Storage.Local.prototype.parseJson_ = function(jsonString) {
  if (jsonString !== null) {
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      // Ignore and return jsonString.
    }
  }
  return jsonString;
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

  const o = {};
  o[e.key] = {
    oldValue: this.parseJson_(e.oldValue),
    newValue: this.parseJson_(e.newValue),
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
 * @override
 */
lib.Storage.Local.prototype.getItem = async function(key) {
  return this.getItems([key]).then((items) => items[key]);
};

/**
 * Fetch the values of multiple storage items.
 *
 * @param {?Array<string>} keys The keys to look up.  Pass null for all keys.
 * @override
 */
lib.Storage.Local.prototype.getItems = async function(keys) {
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
      rv[key] = this.parseJson_(value);
    } else {
      keys.splice(i, 1);
    }
  }

  // Force deferment for the standard API.
  await 0;

  return rv;
};

/**
 * Set a value in storage.
 *
 * @param {string} key The key for the value to be stored.
 * @param {*} value The value to be stored.  Anything that can be serialized
 *     with JSON is acceptable.
 * @override
 */
lib.Storage.Local.prototype.setItem = async function(key, value) {
  return this.setItems({[key]: value});
};

/**
 * Set multiple values in storage.
 *
 * @param {!Object} obj A map of key/values to set in storage.
 * @override
 */
lib.Storage.Local.prototype.setItems = async function(obj) {
  for (const key in obj) {
    this.storage_.setItem(key, JSON.stringify(obj[key]));
  }

  // Force deferment for the standard API.
  await 0;
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
