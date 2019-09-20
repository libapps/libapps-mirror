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
 * @param {function(!Object)=} callback The function to invoke when the
 *     delete has completed.
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
