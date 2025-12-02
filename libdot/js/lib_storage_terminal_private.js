// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../index.js';

/**
 * Storage implementation using chrome.terminalPrivate.
 */
lib.Storage.TerminalPrivate = class extends lib.Storage {
  /**
   * @param {string=} prefPath Path of pref to read and update.  Uses
   *     'crostini.terminal_settings' by default.
   * @param {{
   *   getPrefs: function(!Array<string>, function(?Object)),
   *   setPrefs: function(!Object, function()),
   *   onPrefChanged: !ChromeEvent,
   * }=} storage
   */
  constructor(
      prefPath = 'crostini.terminal_settings',
      storage = chrome.terminalPrivate) {
    super();

    /**
     * @const
     * @private
     */
    this.prefPath_ = lib.notUndefined(prefPath);

    /**
     * Local cache of terminalPrivate.getPrefs().
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

    this.storage_.onPrefChanged.addListener(
        this.onPrefChanged_.bind(this));
  }

  /**
   * Load the settings into our local cache.
   *
   * @return {!Promise<void>} Resolves when settings have been loaded.
   */
  initCache_() {
    return new Promise((resolve) => {
      // NB: This doesn't return Promise.resolve so we're guaranteed to have the
      // initCache_ call always return deferred execution.
      if (this.prefsLoaded_) {
        resolve();
        return;
      }

      this.storage_.getPrefs([this.prefPath_], (prefs) => {
        const err = lib.f.lastError();
        if (err) {
          console.error(err);
        } else {
          this.prefValue_ = lib.notNull(prefs[this.prefPath_]);
        }
        this.prefsLoaded_ = true;
        resolve();
      });
    });
  }

  /**
   * Called when pref changes.
   *
   * @param {!Object<string, *>} prefs
   * @private
   */
  onPrefChanged_(prefs) {
    const pref = /** @type {?Object<string, *>} */(prefs[this.prefPath_]);
    if (!pref || typeof pref !== 'object') {
      return;
    }
    // Check what is deleted.
    const changes = lib.Storage.generateStorageChanges(this.prefValue_, pref);
    this.prefValue_ = pref;

    // Don't bother notifying if there are no changes.
    if (Object.keys(changes).length) {
      setTimeout(() => {
        this.observers_.forEach((o) => o(changes));
      });
    }
  }

  /**
   * Set pref then run callback.  Writes are done async to allow multiple
   * concurrent calls to this function to be batched into a single write.
   *
   * @return {!Promise<void>} Resolves once the pref is set.
   * @private
   */
  setPref_() {
    lib.assert(this.prefsLoaded_);

    return new Promise((resolve) => {
      this.prefValueWriteToResolve_.push(resolve);
      if (this.prefValueWriteToResolve_.length > 1) {
        return;
      }

      // Force deferment to help coalesce.
      setTimeout(() => {
        this.storage_.setPrefs({[this.prefPath_]: this.prefValue_}, () => {
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
  }

  /**
   * Update the internal storage state and generate change events for it.
   *
   * @param {!Object<string, *>} newStorage
   */
  async update_(newStorage) {
    const changes = lib.Storage.generateStorageChanges(
        this.prefValue_, newStorage);
    this.prefValue_ = newStorage;

    await this.setPref_();

    // Don't bother notifying if there are no changes.
    if (Object.keys(changes).length) {
      this.observers_.forEach((o) => o(changes));
    }
  }

  /**
   * @return {!Promise<void>}
   * @override
   */
  async clear() {
    await this.initCache_();
    return this.update_({});
  }

  /**
   * @param {?Array<string>} keys
   * @return {!Promise<!Object<string, *>>}
   * @override
   */
  async getItems(keys) {
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
  }

  /**
   * @param {!Object} obj
   * @return {!Promise<void>}
   * @override
   */
  async setItems(obj) {
    await this.initCache_();
    return this.update_(Object.assign({}, this.prefValue_, obj));
  }

  /**
   * @param {!Array<string>} keys
   * @return {!Promise<void>}
   * @override
   */
  async removeItems(keys) {
    await this.initCache_();
    const newStorage = Object.assign({}, this.prefValue_);
    keys.forEach((key) => delete newStorage[key]);
    return this.update_(newStorage);
  }
};
