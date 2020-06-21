// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Namespace for implementations of persistent, possibly cloud-backed
 * storage.
 *
 * @interface
 */
lib.Storage = function() {};

/**
 * Register a function to observe storage changes.
 *
 * @param {function(!Object)} callback The function to invoke when the storage
 *     changes.
 */
lib.Storage.prototype.addObserver = function(callback) {};

/**
 * Unregister a change observer.
 *
 * @param {function(!Object)} callback A previously registered callback.
 */
lib.Storage.prototype.removeObserver = function(callback) {};

/**
 * Delete everything in this storage.
 *
 * @param {function()=} callback The function to invoke when the delete has
 *     completed.
 */
lib.Storage.prototype.clear = function(callback) {};

/**
 * Return the current value of a storage item.
 *
 * @param {string} key The key to look up.
 * @param {function(*)} callback The function to invoke when the value has
 *     been retrieved.
 */
lib.Storage.prototype.getItem = function(key, callback) {};

/**
 * Fetch the values of multiple storage items.
 *
 * @param {?Array<string>} keys The keys to look up.  Pass null for all keys.
 * @param {function(!Object)} callback The function to invoke when the values
 *     have been retrieved.
 */
lib.Storage.prototype.getItems = function(keys, callback) {};

/**
 * Set a value in storage.
 *
 * @param {string} key The key for the value to be stored.
 * @param {*} value The value to be stored.  Anything that can be serialized
 *     with JSON is acceptable.
 * @param {function()=} callback Function to invoke when the set is complete.
 *     You don't have to wait for the set to complete in order to read the value
 *     since the local cache is updated synchronously.
 */
lib.Storage.prototype.setItem = function(key, value, callback) {};

/**
 * Set multiple values in storage.
 *
 * @param {!Object} obj A map of key/values to set in storage.
 * @param {function()=} callback Function to invoke when the set is complete.
 *     You don't have to wait for the set to complete in order to read the value
 *     since the local cache is updated synchronously.
 */
lib.Storage.prototype.setItems = function(obj, callback) {};

/**
 * Remove an item from storage.
 *
 * @param {string} key The key to be removed.
 * @param {function()=} callback Function to invoke when the remove is complete.
 *     You don't have to wait for the set to complete in order to read the value
 *     since the local cache is updated synchronously.
 */
lib.Storage.prototype.removeItem = function(key, callback) {};

/**
 * Remove multiple items from storage.
 *
 * @param {!Array<string>} keys The keys to be removed.
 * @param {function()=} callback Function to invoke when the remove is complete.
 *     You don't have to wait for the set to complete in order to read the value
 *     since the local cache is updated synchronously.
 */
lib.Storage.prototype.removeItems = function(keys, callback) {};
