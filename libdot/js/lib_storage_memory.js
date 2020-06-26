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
 * @override
 */
lib.Storage.Memory.prototype.getItem = async function(key) {
  return this.getItems([key]).then((items) => items[key]);
};

/**
 * Fetch the values of multiple storage items.
 *
 * @param {?Array<string>} keys The keys to look up.  Pass null for all keys.
 * @override
 */
lib.Storage.Memory.prototype.getItems = async function(keys) {
  const rv = {};
  if (!keys) {
    keys = Object.keys(this.storage_);
  }

  keys.forEach((key) => {
    if (this.storage_.hasOwnProperty(key)) {
      rv[key] = this.storage_[key];
    }
  });

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
lib.Storage.Memory.prototype.setItem = async function(key, value) {
  return this.setItems({[key]: value});
};

/**
 * Set multiple values in storage.
 *
 * @param {!Object} obj A map of key/values to set in storage.
 * @override
 */
lib.Storage.Memory.prototype.setItems = async function(obj) {
  const e = {};

  for (const key in obj) {
    // Normalize through JSON to mimic Local/Chrome backends.
    const newValue = JSON.parse(JSON.stringify(obj[key]));
    e[key] = {oldValue: this.storage_[key], newValue: newValue};
    this.storage_[key] = newValue;
  }

  // Force deferment for the standard API.
  await 0;

  this.observers_.forEach((o) => o(e));
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
