// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * window.localStorage based class with an async interface that is
 * interchangeable with other lib.Storage.* implementations.
 *
 * @implements {lib.Storage}
 * @constructor
 */
lib.Storage.Local = function() {
  this.observers_ = [];
  this.storage_ = window.localStorage;
  window.addEventListener('storage', this.onStorage_.bind(this));
};

/**
 * Called by the storage implementation when the storage is modified.
 *
 * @param {!Event} e The setting that has changed.
 */
lib.Storage.Local.prototype.onStorage_ = function(e) {
  if (e.storageArea != this.storage_) {
    return;
  }

  // JS throws an exception if JSON.parse is given an empty string. So here we
  // only parse if the value is truthy. This mean the empty string, undefined
  // and null will not be parsed.
  var prevValue = e.oldValue ? JSON.parse(e.oldValue) : e.oldValue;
  var curValue = e.newValue ? JSON.parse(e.newValue) : e.newValue;
  var o = {};
  o[e.key] = {
    oldValue: prevValue,
    newValue: curValue,
  };

  for (var i = 0; i < this.observers_.length; i++) {
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
  var i = this.observers_.indexOf(callback);
  if (i != -1) {
    this.observers_.splice(i, 1);
  }
};

/**
 * Delete everything in this storage.
 *
 * @param {function()=} callback The function to invoke when the delete has
 *     completed.
 * @override
 */
lib.Storage.Local.prototype.clear = function(callback) {
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
lib.Storage.Local.prototype.getItem = function(key, callback) {
  var value = this.storage_.getItem(key);

  if (typeof value == 'string') {
    try {
      value = JSON.parse(value);
    } catch (e) {
      // If we can't parse the value, just return it unparsed.
    }
  }

  setTimeout(callback.bind(null, value), 0);
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
  var rv = {};
  if (!keys) {
    keys = [];
    for (let i = 0; i < this.storage_.length; i++) {
      keys.push(this.storage_.key(i));
    }
  }

  for (var i = keys.length - 1; i >= 0; i--) {
    var key = keys[i];
    var value = this.storage_.getItem(key);
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
  this.storage_.setItem(key, JSON.stringify(value));

  if (callback) {
    setTimeout(callback, 0);
  }
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
  for (var key in obj) {
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
 * @param {function()=} callback Function to invoke when the remove is complete.
 *     You don't have to wait for the set to complete in order to read the value
 *     since the local cache is updated synchronously.
 * @override
 */
lib.Storage.Local.prototype.removeItem = function(key, callback) {
  this.storage_.removeItem(key);

  if (callback) {
    setTimeout(callback, 0);
  }
};

/**
 * Remove multiple items from storage.
 *
 * @param {!Array<string>} ary The keys to be removed.
 * @param {function()=} callback Function to invoke when the remove is complete.
 *     You don't have to wait for the set to complete in order to read the value
 *     since the local cache is updated synchronously.
 * @override
 */
lib.Storage.Local.prototype.removeItems = function(ary, callback) {
  for (var i = 0; i < ary.length; i++) {
    this.storage_.removeItem(ary[i]);
  }

  if (callback) {
    setTimeout(callback, 0);
  }
};
