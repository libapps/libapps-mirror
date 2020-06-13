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
  const e = {};
  for (const key in this.prefValue_) {
    if (!settings.hasOwnProperty(key)) {
      e[key] = {oldValue: this.prefValue_[key], newValue: undefined};
    }
  }
  for (const key in e) {
    delete this.prefValue_[key];
  }

  // Check what has changed.
  for (const key in settings) {
    const oldValue = this.prefValue_[key];
    const newValue = settings[key];
    if (newValue === oldValue ||
        JSON.stringify(newValue) === JSON.stringify(oldValue)) {
      continue;
    }
    e[key] = {oldValue, newValue};
    this.prefValue_[key] = newValue;
  }

  setTimeout(() => {
    for (const observer of this.observers_) {
      observer(e);
    }
  }, 0);
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
 * Delete everything in this storage.
 *
 * @param {function()=} callback The function to invoke when the delete has
 *     completed.
 * @override
 */
lib.Storage.TerminalPrivate.prototype.clear = function(callback) {
  this.initCache_().then(() => {
    this.prefValue_ = {};
    this.setPref_().then(() => {
      if (callback) {
        callback();
      }
    });
  });
};

/**
 * Return the current value of a storage item.
 *
 * @param {string} key The key to look up.
 * @param {function(*)} callback The function to invoke when the value has
 *     been retrieved.
 * @override
 */
lib.Storage.TerminalPrivate.prototype.getItem = function(key, callback) {
  this.initCache_().then(() => callback(this.prefValue_[key]));
};

/**
 * Fetch the values of multiple storage items.
 *
 * @param {?Array<string>} keys The keys to look up.  Pass null for all keys.
 * @param {function(!Object)} callback The function to invoke when the values
 *     have been retrieved.
 * @override
 */
lib.Storage.TerminalPrivate.prototype.getItems = function(keys, callback) {
  this.initCache_().then(() => {
    const rv = {};
    if (!keys) {
      keys = Object.keys(this.prefValue_);
    }

    for (const key of keys) {
      if (this.prefValue_.hasOwnProperty(key)) {
        rv[key] = this.prefValue_[key];
      }
    }

    callback(rv);
  });
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
lib.Storage.TerminalPrivate.prototype.setItem = function(key, value, callback) {
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
lib.Storage.TerminalPrivate.prototype.setItems = function(obj, callback) {
  this.initCache_().then(() => {
    const e = {};

    for (const key in obj) {
      e[key] = {oldValue: this.prefValue_[key], newValue: obj[key]};
      this.prefValue_[key] = obj[key];
    }

    return this.setPref_().then(() => {
      if (callback) {
        callback();
      }
      return e;
    });
  })
  .then((e) => {
    for (const observer of this.observers_) {
      observer(e);
    }
  });
};

/**
 * Remove an item from storage.
 *
 * @param {string} key The key to be removed.
 * @param {function()=} callback Function to invoke when the remove is complete.
 *     The local cache is updated synchronously, so reads will immediately
 *     return undefined for this item even before removeItem completes.
 * @override
 */
lib.Storage.TerminalPrivate.prototype.removeItem = function(key, callback) {
  this.removeItems([key], callback);
};

/**
 * Remove multiple items from storage.
 *
 * @param {!Array<string>} keys The keys to be removed.
 * @param {function()=} callback Function to invoke when the remove is complete.
 *     The local cache is updated synchronously, so reads will immediately
 *     return undefined for these items even before removeItems completes.
 * @override
 */
lib.Storage.TerminalPrivate.prototype.removeItems = function(keys, callback) {
  this.initCache_().then(() => {
    for (const key of keys) {
      delete this.prefValue_[key];
    }
    this.setPref_().then(() => {
      if (callback) {
        callback();
      }
    });
  });
};
