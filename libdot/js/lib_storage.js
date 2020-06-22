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
 * @param {function(!Object<string, !StorageChange>)} callback The function to
 *     invoke when the storage changes.
 */
lib.Storage.prototype.addObserver = function(callback) {};

/**
 * Unregister a change observer.
 *
 * @param {function(!Object<string, !StorageChange>)} callback A previously
 *     registered callback.
 */
lib.Storage.prototype.removeObserver = function(callback) {};

/**
 * Delete everything in this storage.
 */
lib.Storage.prototype.clear = async function() {};

/**
 * Return the current value of a storage item.
 *
 * @param {string} key The key to look up.
 * @return {!Promise<*>} A promise resolving to the requested item.
 */
lib.Storage.prototype.getItem = async function(key) {};

/**
 * Fetch the values of multiple storage items.
 *
 * @param {?Array<string>} keys The keys to look up.  Pass null for all keys.
 * @return {!Promise<!Object<string, *>>} A promise resolving to the requested
 *     items.
 */
lib.Storage.prototype.getItems = async function(keys) {};

/**
 * Set a value in storage.
 *
 * You don't have to wait for the set to complete in order to read the value
 * since the local cache is updated synchronously.
 *
 * @param {string} key The key for the value to be stored.
 * @param {*} value The value to be stored.  Anything that can be serialized
 *     with JSON is acceptable.
 */
lib.Storage.prototype.setItem = async function(key, value) {};

/**
 * Set multiple values in storage.
 *
 * You don't have to wait for the set to complete in order to read the value
 * since the local cache is updated synchronously.
 *
 * @param {!Object} obj A map of key/values to set in storage.
 */
lib.Storage.prototype.setItems = async function(obj) {};

/**
 * Remove an item from storage.
 *
 * @param {string} key The key to be removed.
 */
lib.Storage.prototype.removeItem = async function(key) {};

/**
 * Remove multiple items from storage.
 *
 * @param {!Array<string>} keys The keys to be removed.
 */
lib.Storage.prototype.removeItems = async function(keys) {};
