// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../index.js';

/**
 * Constructor for lib.PreferenceManager objects.
 *
 * These objects deal with persisting changes to stable storage and notifying
 * consumers when preferences change.
 *
 * It is intended that the backing store could be something other than HTML5
 * storage, but there aren't any use cases at the moment.  In the future there
 * may be a chrome api to store sync-able name/value pairs, and we'd want
 * that.
 */
lib.PreferenceManager = class {
  /**
   * @param {!lib.Storage} storage The storage object to use as a backing
   *     store.
   * @param {string=} prefix The optional prefix to be used for all preference
   *     names.  The '/' character should be used to separate levels of
   *     hierarchy, if you're going to have that kind of thing.  If provided,
   *     the prefix should start with a '/'.  If not provided, it defaults to
   *     '/'.
   */
  constructor(storage, prefix = '/') {
    this.storage = storage;
    this.storageObserver_ = this.onStorageChange_.bind(this);
    this.storage.addObserver(this.storageObserver_);

    this.trace = false;

    if (!prefix.endsWith('/')) {
      prefix += '/';
    }

    this.prefix = prefix;

    // Internal state for when we're doing a bulk import from JSON and we want
    // to elide redundant storage writes (for quota reasons).
    this.isImportingJson_ = false;

    /** @type {!Object<string, !Record>} */
    this.prefRecords_ = {};
    this.globalObservers_ = new lib.Event();
    this.onPrefixChange = new lib.Event();

    this.childFactories_ = {};

    // Map of list-name to {map of child pref managers}
    // As in...
    //
    //  this.childLists_ = {
    //    'profile-ids': {
    //      'one': PreferenceManager,
    //      'two': PreferenceManager,
    //      ...
    //    },
    //
    //    'frob-ids': {
    //      ...
    //    }
    //  }
    this.childLists_ = {};
  }

  /**
   * Update prefix and reset and reload storage, then notify prefix observers,
   * and all pref observers with new values.
   *
   * @param {string} prefix
   * return {!Promise<void>} When prefix has finished updating.
   */
  async setPrefix(prefix) {
    if (!prefix.endsWith('/')) {
      prefix += '/';
    }
    if (prefix === this.prefix) {
      return;
    }

    this.prefix = prefix;

    for (const name in this.prefRecords_) {
      this.prefRecords_[name].currentValue = this.DEFAULT_VALUE;
    }

    await this.readStorage();
    this.onPrefixChange.emit(this.prefix, this);
    this.notifyAll();
  }

  /**
   * Read the backing storage for these preferences.
   *
   * You should do this once at initialization time to prime the local cache
   * of preference values.  The preference manager will monitor the backing
   * storage for changes, so you should not need to call this more than once.
   *
   * This function recursively reads storage for all child preference managers
   * as well.
   *
   * This function is asynchronous, if you need to read preference values, you
   * *must* wait for the callback.
   *
   * @return {!Promise<void>} When storage has finished loading.
   */
  async readStorage() {
    const keys = Object.keys(this.prefRecords_).map((el) => this.prefix + el);

    if (this.trace) {
      console.log(`Preferences read: ${this.prefix}`);
    }

    const items = await this.storage.getItems(keys);
    const prefixLength = this.prefix.length;

    for (const key in items) {
      const value = items[key];
      const name = key.substr(prefixLength);
      const needSync = (
          name in this.childLists_ &&
          (JSON.stringify(value) !=
           JSON.stringify(this.prefRecords_[name].currentValue)));

      this.prefRecords_[name].currentValue = value;

      if (needSync) {
        await this.syncChildList(name);
      }
    }
  }

  /**
   * Define a preference.
   *
   * This registers a name, default value, and onChange handler for a
   * preference.
   *
   * @param {string} name The name of the preference.  This will be prefixed by
   *     the prefix of this PreferenceManager before written to local storage.
   * @param {string|number|boolean|!Object|!Array|null} value The default value
   *     of this preference.  Anything that can be represented in JSON is a
   *     valid default value.
   * @param {function(*, string, !lib.PreferenceManager)=} onChange A
   *     function to invoke when the preference changes.  It will receive the
   *     new value, the name of the preference, and a reference to the
   *     PreferenceManager as parameters.
   */
  definePreference(name, value, onChange = undefined) {
    let record = this.prefRecords_[name];
    if (record) {
      this.changeDefault(name, value);
    } else {
      record = this.prefRecords_[name] = new Record(name, value);
    }

    if (onChange) {
      record.onChange.addListener(onChange);
    }
  }

  /**
   * Define multiple preferences with a single function call.
   *
   * @param {!Array<*>} defaults An array of 3-element arrays.  Each three
   *     element array should contain the [key, value, onChange] parameters for
   *     a preference.
   */
  definePreferences(defaults) {
    for (let i = 0; i < defaults.length; i++) {
      this.definePreference(defaults[i][0], defaults[i][1], defaults[i][2]);
    }
  }

  /**
   * Define an ordered list of child preferences.
   *
   * Child preferences are different from just storing an array of JSON objects
   * in that each child is an instance of a preference manager.  This means you
   * can observe changes to individual child preferences, and get some
   * validation that you're not reading or writing to an undefined child
   * preference value.
   *
   * @param {string} listName A name for the list of children.  This must be
   *     unique in this preference manager.  The listName will become a
   *     preference on this PreferenceManager used to store the ordered list of
   *     child ids.  It is also used in get/add/remove operations to identify
   *     the list of children to operate on.
   * @param {function(!lib.PreferenceManager, string)} childFactory A function
   *     that will be used to generate instances of these children.  The factory
   *     function will receive the parent lib.PreferenceManager object and a
   *     unique id for the new child preferences.
   */
  defineChildren(listName, childFactory) {
    // Define a preference to hold the ordered list of child ids.
    this.definePreference(listName, [],
                          this.onChildListChange_.bind(this, listName));
    this.childFactories_[listName] = childFactory;
    this.childLists_[listName] = {};
  }

  /**
   * Register to observe preference changes.
   *
   * @param {string} name The name of preference you wish to observe..
   * @param {function(*, string, !lib.PreferenceManager)} observer The callback.
   */
  addObserver(name, observer) {
    if (!(name in this.prefRecords_)) {
      throw new Error(`Unknown preference: ${name}`);
    }

    this.prefRecords_[name].onChange.addListener(observer);
  }

  /**
   * Register to observe preference changes.
   *
   * @param {?function()} global A callback that will happen for every
   *     preference.  Pass null if you don't need one.
   * @param {!Object} map A map of preference specific callbacks.  Pass null if
   *     you don't need any.
   */
  addObservers(global, map) {
    if (global && typeof global != 'function') {
      throw new Error('Invalid param: globals');
    }

    if (global) {
      this.globalObservers_.addListener(global);
    }

    if (!map) {
      return;
    }

    for (const name in map) {
      this.addObserver(name, map[name]);
    }
  }

  /**
   * Remove preference observer.
   *
   * @param {string} name The name of preference you wish to stop observing.
   * @param {function(*, string, !lib.PreferenceManager)} observer The observer
   *     to remove.
   */
  removeObserver(name, observer) {
    if (!(name in this.prefRecords_)) {
      throw new Error(`Unknown preference: ${name}`);
    }

    this.prefRecords_[name].onChange.removeListener(observer);
  }

  /**
   * Dispatch the change observers for all known preferences.
   *
   * It may be useful to call this after readStorage completes, in order to
   * get application state in sync with user preferences.
   *
   * This can be used if you've changed a preference manager out from under
   * a live object, for example when switching to a different prefix.
   */
  notifyAll() {
    for (const name in this.prefRecords_) {
      this.notifyChange_(name);
    }
  }

  /**
   * Notify the change observers for a given preference.
   *
   * @param {string} name The name of the preference that changed.
   */
  notifyChange_(name) {
    const record = this.prefRecords_[name];
    if (!record) {
      throw new Error(`Unknown preference: ${name}`);
    }

    const currentValue = record.get();
    this.globalObservers_.emit(name, currentValue);
    record.onChange.emit(currentValue, name, this);
  }

  /**
   * Create a new child PreferenceManager for the given child list.
   *
   * The optional hint parameter is an opaque prefix added to the auto-generated
   * unique id for this child.  Your child factory can parse out the prefix
   * and use it.
   *
   * @param {string} listName The child list to create the new instance from.
   * @param {?string=} prefix Optional prefix to include in the child id.
   * @param {string=} id Optional id to override the generated id.
   * @return {!lib.PreferenceManager} The new child preference manager.
   */
  createChild(listName, prefix = undefined, id = undefined) {
    const ids = /** @type {!Array<string>} */ (this.get(listName));

    if (id) {
      if (ids.indexOf(id) != -1) {
        throw new Error(`Duplicate child: ${listName}: ${id}`);
      }

    } else {
      id = lib.PreferenceManager.newRandomId(ids, prefix);
    }

    const childManager = this.childFactories_[listName](this, id);
    childManager.trace = this.trace;
    childManager.resetAll();

    this.childLists_[listName][id] = childManager;

    ids.push(id);
    this.set(listName, ids, undefined, !this.isImportingJson_);

    return childManager;
  }

  /**
   * Remove a child preferences instance.
   *
   * Removes a child preference manager and clears any preferences stored in it.
   *
   * @param {string} listName The name of the child list containing the child to
   *     remove.
   * @param {string} id The child ID.
   */
  removeChild(listName, id) {
    const prefs = this.getChild(listName, id);
    prefs.resetAll();

    const ids = /** @type {!Array<string>} */ (this.get(listName));
    const i = ids.indexOf(id);
    if (i != -1) {
      ids.splice(i, 1);
      this.set(listName, ids, undefined, !this.isImportingJson_);
    }

    delete this.childLists_[listName][id];
  }

  /**
   * Return a child PreferenceManager instance for a given id.
   *
   * If the child list or child id is not known this will return the specified
   * default value or throw an exception if no default value is provided.
   *
   * @param {string} listName The child list to look in.
   * @param {string} id The child ID.
   * @param {!lib.PreferenceManager=} defaultValue The value to return if the
   *     child is not found.
   * @return {!lib.PreferenceManager} The specified child PreferenceManager.
   */
  getChild(listName, id, defaultValue = undefined) {
    if (!(listName in this.childLists_)) {
      throw new Error(`Unknown child list: ${listName}`);
    }

    const childList = this.childLists_[listName];
    if (!(id in childList)) {
      if (defaultValue === undefined) {
        throw new Error(`Unknown "${listName}" child: ${id}`);
      }

      return defaultValue;
    }

    return childList[id];
  }

  /**
   * Synchronize a list of child PreferenceManagers instances with the current
   * list stored in prefs.
   *
   * This will instantiate any missing managers and read current preference
   * values from storage.  Any active managers that no longer appear in
   * preferences will be deleted.
   *
   * @param {string} listName The child list to synchronize.
   * @return {!Promise<void>} When child has finished loading.
   */
  async syncChildList(listName) {
    // The list of child ids that we *should* have a manager for.
    const currentIds = /** @type {!Array<string>} */ (this.get(listName));

    // The known managers at the start of the sync.  Any manager still in this
    // list at the end should be discarded.
    const oldIds = Object.keys(this.childLists_[listName]);

    for (let i = 0; i < currentIds.length; i++) {
      const id = currentIds[i];

      const managerIndex = oldIds.indexOf(id);
      if (managerIndex >= 0) {
        oldIds.splice(managerIndex, 1);
      }

      if (!this.childLists_[listName][id]) {
        const childManager = this.childFactories_[listName](this, id);
        if (!childManager) {
          console.warn(`Unable to restore child: ${listName}: ${id}`);
          continue;
        }

        childManager.trace = this.trace;
        this.childLists_[listName][id] = childManager;
        await childManager.readStorage();
      }
    }

    for (let i = 0; i < oldIds.length; i++) {
      delete this.childLists_[listName][oldIds[i]];
    }
  }

  /**
   * Reset a preference to its default state.
   *
   * This will dispatch the onChange handler if the preference value actually
   * changes.
   *
   * @param {string} name The preference to reset.
   */
  reset(name) {
    const record = this.prefRecords_[name];
    if (!record) {
      throw new Error(`Unknown preference: ${name}`);
    }

    this.storage.removeItem(this.prefix + name);

    if (record.currentValue !== this.DEFAULT_VALUE) {
      record.currentValue = this.DEFAULT_VALUE;
      this.notifyChange_(name);
    }
  }

  /**
   * Reset all preferences back to their default state.
   */
  resetAll() {
    const changed = [];

    for (const listName in this.childLists_) {
      const childList = this.childLists_[listName];
      for (const id in childList) {
        childList[id].resetAll();
      }
    }

    for (const name in this.prefRecords_) {
      if (this.prefRecords_[name].currentValue !== this.DEFAULT_VALUE) {
        this.prefRecords_[name].currentValue = this.DEFAULT_VALUE;
        changed.push(name);
      }
    }

    const keys = Object.keys(this.prefRecords_).map(function(el) {
        return this.prefix + el;
    }.bind(this));

    this.storage.removeItems(keys);

    changed.forEach(this.notifyChange_.bind(this));
  }

  /**
   * Return true if two values should be considered not-equal.
   *
   * If both values are the same scalar type and compare equal this function
   * returns false (no difference), otherwise return true.
   *
   * This is used in places where we want to check if a preference has changed.
   * Compare complex values (objects or arrays) using JSON serialization.
   * Objects with more than a single primitive property may not have the same
   * JSON serialization, but for our purposes with default objects, this is OK.
   *
   * @param {*} a A value to compare.
   * @param {*} b A value to compare.
   * @return {boolean} Whether the two are not equal.
   */
  diff(a, b) {
    // If the types are different.
    if ((typeof a) !== (typeof b)) {
      return true;
    }

    // Or if the type is not a simple primitive one.
    if (!(/^(undefined|boolean|number|string)$/.test(typeof a))) {
      // Special case the null object.
      if (a === null && b === null) {
        return false;
      } else {
        return JSON.stringify(a) !== JSON.stringify(b);
      }
    }

    // Do a normal compare for primitive types.
    return a !== b;
  }

  /**
   * Change the default value of a preference.
   *
   * This is useful when subclassing preference managers.
   *
   * The function does not alter the current value of the preference, unless
   * it has the old default value.  When that happens, the change observers
   * will be notified.
   *
   * @param {string} name The name of the parameter to change.
   * @param {*} newValue The new default value for the preference.
   */
  changeDefault(name, newValue) {
    const record = this.prefRecords_[name];
    if (!record) {
      throw new Error(`Unknown preference: ${name}`);
    }

    if (!this.diff(record.defaultValue, newValue)) {
      // Default value hasn't changed.
      return;
    }

    if (record.currentValue !== this.DEFAULT_VALUE) {
      // This pref has a specific value, just change the default and we're done.
      record.defaultValue = newValue;
      return;
    }

    record.defaultValue = newValue;

    this.notifyChange_(name);
  }

  /**
   * Change the default value of multiple preferences.
   *
   * @param {!Object} map A map of name -> value pairs specifying the new
   *     default values.
   */
  changeDefaults(map) {
    for (const key in map) {
      this.changeDefault(key, map[key]);
    }
  }

  /**
   * Set a preference to a specific value.
   *
   * This will dispatch the onChange handler if the preference value actually
   * changes.
   *
   * @param {string} name The preference to set.
   * @param {*} newValue The value to set.  Anything that can be represented in
   *     JSON is a valid value.
   * @param {function()=} onComplete Callback when the set call completes.
   * @param {boolean=} saveToStorage Whether to commit the change to the backing
   *     storage or only the in-memory record copy.
   * @return {!Promise<void>} Promise which resolves once all observers are
   *     notified.
   */
  set(name, newValue, onComplete = undefined, saveToStorage = true) {
    const record = this.prefRecords_[name];
    if (!record) {
      throw new Error(`Unknown preference: ${name}`);
    }

    const oldValue = record.get();

    if (!this.diff(oldValue, newValue)) {
      return Promise.resolve();
    }

    if (this.diff(record.defaultValue, newValue)) {
      record.currentValue = newValue;
      if (saveToStorage) {
        this.storage.setItem(this.prefix + name, newValue).then(onComplete);
      }
    } else {
      record.currentValue = this.DEFAULT_VALUE;
      if (saveToStorage) {
        this.storage.removeItem(this.prefix + name).then(onComplete);
      }
    }

    // We need to manually send out the notification on this instance.  If we
    // The storage event won't fire a notification because we've already changed
    // the currentValue, so it won't see a difference.  If we delayed changing
    // currentValue until the storage event, a pref read immediately after a
    // write would return the previous value.
    //
    // The notification is async so clients don't accidentally depend on
    // a synchronous notification.
    return Promise.resolve().then(() => {
      this.notifyChange_(name);
    });
  }

  /**
   * Get the value of a preference.
   *
   * @param {string} name The preference to get.
   * @return {*} The preference's value.
   */
  get(name) {
    const record = this.prefRecords_[name];
    if (!record) {
      throw new Error(`Unknown preference: ${name}`);
    }

    return record.get();
  }

  /**
   * Get the default value of a preference.
   *
   * @param {string} name The preference to get.
   * @return {*} The preference's default value.
   */
  getDefault(name) {
    const record = this.prefRecords_[name];
    if (!record) {
      throw new Error(`Unknown preference: ${name}`);
    }

    return record.defaultValue;
  }

  /**
   * Get the boolean value of a preference.
   *
   * @param {string} name The preference to get.
   * @return {boolean}
   */
  getBoolean(name) {
    const result = this.get(name);
    lib.assert(typeof result == 'boolean');
    return result;
  }

  /**
   * Get the number value of a preference.
   *
   * @param {string} name The preference to get.
   * @return {number}
   */
  getNumber(name) {
    const result = this.get(name);
    lib.assert(typeof result == 'number');
    return result;
  }

  /**
   * Get the string value of a preference.
   *
   * @param {string} name The preference to get.
   * @return {string}
   */
  getString(name) {
    const result = this.get(name);
    lib.assert(typeof result == 'string');
    return result;
  }

  /**
   * Return all non-default preferences as a JSON object.
   *
   * This includes any nested preference managers as well.
   *
   * @return {!Object} The JSON preferences.
   */
  exportAsJson() {
    const rv = {};

    for (const name in this.prefRecords_) {
      if (name in this.childLists_) {
        rv[name] = [];
        const childIds = /** @type {!Array<string>} */ (this.get(name));
        for (let i = 0; i < childIds.length; i++) {
          const id = childIds[i];
          rv[name].push({id: id, json: this.getChild(name, id).exportAsJson()});
        }

      } else {
        const record = this.prefRecords_[name];
        if (record.currentValue != this.DEFAULT_VALUE) {
          rv[name] = record.currentValue;
        }
      }
    }

    return rv;
  }

  /**
   * Import a JSON blob of preferences previously generated with exportAsJson.
   *
   * This will create nested preference managers as well.
   *
   * @param {!Object} json The JSON settings to import.
   * @return {!Promise<void>} A promise that resolves once the import completes.
   */
  async importFromJson(json) {
    this.isImportingJson_ = true;

    // Clear the current prefernces back to their defaults, and throw away any
    // children.  We'll recreate them if needed.
    for (const listName in this.childLists_) {
      const childList = this.childLists_[listName];
      for (const id in childList) {
        this.removeChild(listName, id);
      }
    }
    this.resetAll();

    for (const name in json) {
      if (name in this.childLists_) {
        const childList = json[name];
        const ids = [];
        for (let i = 0; i < childList.length; i++) {
          const id = childList[i].id;
          ids.push(id);

          let childPrefManager = this.childLists_[name][id];
          if (!childPrefManager) {
            childPrefManager = this.createChild(name, null, id);
          }

          await childPrefManager.importFromJson(childList[i].json);
        }
        // Update the list of children now that we've finished creating them.
        await this.set(name, ids);
      } else {
        await this.set(name, json[name]);
      }
    }

    this.isImportingJson_ = false;
  }

  /**
   * Called when one of the child list preferences changes.
   *
   * @param {string} listName The child list to synchronize.
   */
  onChildListChange_(listName) {
    this.syncChildList(listName);
  }

  /**
   * Called when a key in the storage changes.
   *
   * @param {!Object} map Dictionary of changed settings.
   */
  onStorageChange_(map) {
    for (const key in map) {
      if (this.prefix) {
        if (key.lastIndexOf(this.prefix, 0) != 0) {
          continue;
        }
      }

      const name = key.substr(this.prefix.length);

      if (!(name in this.prefRecords_)) {
        // Sometimes we'll get notified about prefs that are no longer defined.
        continue;
      }

      const record = this.prefRecords_[name];

      const newValue = map[key].newValue;
      let currentValue = record.currentValue;
      if (currentValue === record.DEFAULT_VALUE) {
        currentValue = undefined;
      }

      if (this.diff(currentValue, newValue)) {
        if (typeof newValue == 'undefined' || newValue === null) {
          record.currentValue = record.DEFAULT_VALUE;
        } else {
          record.currentValue = newValue;
        }

        this.notifyChange_(name);
      }
    }
  }
};

// Suppress linter for bug
// https://github.com/gajus/eslint-plugin-jsdoc/issues/932
//
// eslint-disable-next-line jsdoc/require-returns-check
/**
 * Generate a random, 4-digit hex identifier.
 *
 * @param {!Array<string>=} existingIds A list of existing ids to avoid.
 * @param {?string=} prefix Optional prefix to include in the id.
 * @return {string} The id.
 */
lib.PreferenceManager.newRandomId = function(
    existingIds = [], prefix = undefined) {
  // Pick a random, unique 4-digit hex identifier for the new profile.
  while (true) {
    let id = lib.f.randomInt(1, 0xffff).toString(16);
    id = lib.f.zpad(id, 4);
    if (prefix) {
      id = `${prefix}:${id}`;
    }
    if (existingIds.indexOf(id) === -1) {
      return id;
    }
  }
};

/**
 * Used internally to indicate that the current value of the preference should
 * be taken from the default value defined with the preference.
 *
 * Equality tests against this value MUST use '===' or '!==' to be accurate.
 *
 * @type {symbol}
 */
lib.PreferenceManager.prototype.DEFAULT_VALUE = Symbol('DEFAULT_VALUE');

/**
 * An individual preference.
 *
 * These objects are managed by the PreferenceManager, you shouldn't need to
 * handle them directly.
 */
class Record {
  /**
   * @param {string} name The name of the new preference (used for indexing).
   * @param {*} defaultValue The default value for this preference.
   */
  constructor(name, defaultValue) {
    this.name = name;
    this.defaultValue = defaultValue;
    this.currentValue = this.DEFAULT_VALUE;
    this.onChange = new lib.Event();
  }

  /**
   * Fetch the value of this preference.
   *
   * @return {*} The value for this preference.
   */
  get() {
    const result = this.currentValue === this.DEFAULT_VALUE ?
        this.defaultValue : this.currentValue;

    if (typeof this.defaultValue === 'object') {
      // We want to return a COPY of the value so that users can
      // modify the array or object without changing the value.
      return JSON.parse(JSON.stringify(result));
    }

    return result;
  }
}

/**
 * A local copy of the DEFAULT_VALUE constant to make it less verbose.
 *
 * @type {symbol}
 */
Record.prototype.DEFAULT_VALUE = lib.PreferenceManager.prototype.DEFAULT_VALUE;
