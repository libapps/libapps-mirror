// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Storage implementation using chrome.settingsPrivate.
 *
 * @param {{
 *  getSettings: function(function(?Object)),
 *  setSettings: function(!Object, function()),
 *  onSettingsChanged: !ChromeEvent,
 * }=} storage
 * @constructor
 * @implements {lib.Storage}
 */
lib.Storage.TerminalPrivate = function(storage = chrome.terminalPrivate) {
  /**
   * @const
   * @private
   */
  this.observers_ = [];

  /**
   * Local cache of terminalPrivate.getSettings.
   *
   * @private {!Object<string, *>}
   */
  this.prefValue_ = {};

  /**
   * We do async writes to terminalPrivate.setSettings to allow multiple sync
   * writes to be batched.  This array holds the list of pending resolve calls
   * that we'll invoke when the current write finishes.
   *
   * @private {!Array<function()>}
   */
  this.prefValueWriteToResolve_ = [];

  /** @type {boolean} */
  this.prefsLoaded_ = false;

  /** @const */
  this.storage_ = storage;

  this.storage_.onSettingsChanged.addListener(
      this.onSettingsChanged_.bind(this));
};

/**
 * Load the settings into our local cache.
 *
 * @return {!Promise<void>} Resolves when settings have been loaded.
 */
lib.Storage.TerminalPrivate.prototype.initCache_ = function() {
  return new Promise((resolve) => {
    // NB: This doesn't return Promise.resolve so we're guaranteed to have the
    // initCache_ call always return deferred execution.
    if (this.prefsLoaded_) {
      resolve();
      return;
    }

    this.storage_.getSettings((settings) => {
      const err = lib.f.lastError();
      if (err) {
        console.error(err);
      } else {
        this.prefValue_ = lib.notNull(settings);
      }
      this.prefsLoaded_ = true;
      resolve();
    });
  });
};

/**
 * Called when settings change.
 *
 * @param {!Object<string, *>} settings
 * @private
 */
lib.Storage.TerminalPrivate.prototype.onSettingsChanged_ = function(settings) {
  // Check what is deleted.
  const changes = lib.Storage.generateStorageChanges(this.prefValue_, settings);
  this.prefValue_ = settings;

  // Don't bother notifying if there are no changes.
  if (Object.keys(changes).length) {
    setTimeout(() => {
      this.observers_.forEach((o) => o(changes));
    });
  }
};

/**
 * Set pref then run callback.  Writes are done async to allow multiple
 * concurrent calls to this function to be batched into a single write.
 *
 * @return {!Promise<void>} Resolves once the pref is set.
 * @private
 */
lib.Storage.TerminalPrivate.prototype.setPref_ = function() {
  lib.assert(this.prefsLoaded_);

  return new Promise((resolve) => {
    this.prefValueWriteToResolve_.push(resolve);
    if (this.prefValueWriteToResolve_.length > 1) {
      return;
    }

    // Force deferment to help coalesce.
    setTimeout(() => {
      this.storage_.setSettings(this.prefValue_, () => {
        const err = lib.f.lastError();
        if (err) {
          console.error(err);
        }
        // Resolve all the pending promises so their callbacks will be invoked
        // once this function returns.
        this.prefValueWriteToResolve_.forEach((r) => r());
        this.prefValueWriteToResolve_ = [];
      });
    });
  });
};

/**
 * Register a function to observe storage changes.
 *
 * @param {function(!Object)} callback The function to invoke when the storage
 *     changes.
 * @override
 */
lib.Storage.TerminalPrivate.prototype.addObserver = function(callback) {
  this.observers_.push(callback);
};

/**
 * Unregister a change observer.
 *
 * @param {function(!Object)} callback A previously registered callback.
 * @override
 */
lib.Storage.TerminalPrivate.prototype.removeObserver = function(callback) {
  const i = this.observers_.indexOf(callback);
  if (i !== -1) {
    this.observers_.splice(i, 1);
  }
};

/**
 * Update the internal storage state and generate change events for it.
 *
 * @param {!Object<string, *>} newStorage
 */
lib.Storage.TerminalPrivate.prototype.update_ = async function(newStorage) {
  const changes = lib.Storage.generateStorageChanges(
      this.prefValue_, newStorage);
  this.prefValue_ = newStorage;

  await this.setPref_();

  // Don't bother notifying if there are no changes.
  if (Object.keys(changes).length) {
    this.observers_.forEach((o) => o(changes));
  }
};

/**
 * Delete everything in this storage.
 *
 * @override
 */
lib.Storage.TerminalPrivate.prototype.clear = async function() {
  await this.initCache_();
  return this.update_({});
};

/**
 * Return the current value of a storage item.
 *
 * @param {string} key The key to look up.
 * @override
 */
lib.Storage.TerminalPrivate.prototype.getItem = async function(key) {
  await this.initCache_();
  return this.prefValue_[key];
};

/**
 * Fetch the values of multiple storage items.
 *
 * @param {?Array<string>} keys The keys to look up.  Pass null for all keys.
 * @override
 */
lib.Storage.TerminalPrivate.prototype.getItems = async function(keys) {
  await this.initCache_();

  const rv = {};
  if (!keys) {
    keys = Object.keys(this.prefValue_);
  }

  for (const key of keys) {
    if (this.prefValue_.hasOwnProperty(key)) {
      rv[key] = this.prefValue_[key];
    }
  }

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
lib.Storage.TerminalPrivate.prototype.setItem = async function(key, value) {
  return this.setItems({[key]: value});
};

/**
 * Set multiple values in storage.
 *
 * @param {!Object} obj A map of key/values to set in storage.
 * @override
 */
lib.Storage.TerminalPrivate.prototype.setItems = async function(obj) {
  await this.initCache_();
  return this.update_(Object.assign({}, this.prefValue_, obj));
};

/**
 * Remove an item from storage.
 *
 * @param {string} key The key to be removed.
 * @override
 */
lib.Storage.TerminalPrivate.prototype.removeItem = async function(key) {
  return this.removeItems([key]);
};

/**
 * Remove multiple items from storage.
 *
 * @param {!Array<string>} keys The keys to be removed.
 * @override
 */
lib.Storage.TerminalPrivate.prototype.removeItems = async function(keys) {
  await this.initCache_();
  const newStorage = Object.assign({}, this.prefValue_);
  keys.forEach((key) => delete newStorage[key]);
  return this.update_(newStorage);
};
