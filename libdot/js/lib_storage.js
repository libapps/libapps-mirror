// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../index.js';

/**
 * Namespace for implementations of persistent, possibly cloud-backed
 * storage.
 */
lib.Storage = class {
  constructor() {}

  /**
   * Register a function to observe storage changes.
   *
   * @param {function(!Object<string, !StorageChange>)} callback The function to
   *     invoke when the storage changes.
   */
  addObserver(callback) {}

  /**
   * Unregister a change observer.
   *
   * @param {function(!Object<string, !StorageChange>)} callback A previously
   *     registered callback.
   */
  removeObserver(callback) {}

  /**
   * Delete everything in this storage.
   */
  async clear() {}

  /**
   * Return the current value of a storage item.
   *
   * @param {string} key The key to look up.
   * @return {!Promise<*>} A promise resolving to the requested item.
   */
  async getItem(key) {}

  /**
   * Fetch the values of multiple storage items.
   *
   * @param {?Array<string>} keys The keys to look up.  Pass null for all keys.
   * @return {!Promise<!Object<string, *>>} A promise resolving to the requested
   *     items.
   */
  async getItems(keys) {}

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
  async setItem(key, value) {}

  /**
   * Set multiple values in storage.
   *
   * You don't have to wait for the set to complete in order to read the value
   * since the local cache is updated synchronously.
   *
   * @param {!Object} obj A map of key/values to set in storage.
   */
  async setItems(obj) {}

  /**
   * Remove an item from storage.
   *
   * @param {string} key The key to be removed.
   */
  async removeItem(key) {}

  /**
   * Remove multiple items from storage.
   *
   * @param {!Array<string>} keys The keys to be removed.
   */
  async removeItems(keys) {}
};

/**
 * Create the set of changes between two states.
 *
 * This is used to synthesize the equivalent of Chrome's StorageEvent for use
 * by our stub APIs and testsuites.  We expect Chrome's StorageEvent to also
 * match the web's Storage API & window.onstorage events.
 *
 * @param {!Object<string, *>} oldStorage The old storage state.
 * @param {!Object<string, *>} newStorage The new storage state.
 * @return {!Object<string, {oldValue: ?, newValue: ?}>} The changes.
 */
lib.Storage.generateStorageChanges = function(oldStorage, newStorage) {
  const changes = {};

  // See what's changed.
  for (const key in newStorage) {
    const newValue = newStorage[key];
    if (oldStorage.hasOwnProperty(key)) {
      // Key has been updated.
      const oldValue = oldStorage[key];
      if (oldValue !== newValue) {
        changes[key] = {oldValue, newValue};
      }
    } else {
      // Key has been added.
      changes[key] = {newValue};
    }
  }

  // See what's deleted.
  for (const key in oldStorage) {
    if (!newStorage.hasOwnProperty(key)) {
      changes[key] = {oldValue: oldStorage[key]};
    }
  }

  return changes;
};
