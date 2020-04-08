// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

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
 *
 * @param {!lib.Storage} storage The storage object to use as a backing
 *     store.
 * @param {string=} prefix The optional prefix to be used for all preference
 *     names.  The '/' character should be used to separate levels of hierarchy,
 *     if you're going to have that kind of thing.  If provided, the prefix
 *     should start with a '/'.  If not provided, it defaults to '/'.
 * @constructor
 */
lib.PreferenceManager = function(storage, prefix = '/') {
  this.storage = storage;
  this.storageObserver_ = this.onStorageChange_.bind(this);

  this.isActive_ = false;
  this.activate();

  this.trace = false;

  if (!prefix.endsWith('/')) {
    prefix += '/';
  }

  this.prefix = prefix;

  // Internal state for when we're doing a bulk import from JSON and we want
  // to elide redundant storage writes (for quota reasons).
  this.isImportingJson_ = false;

  /** @type {!Object<string, !lib.PreferenceManager.Record>} */
  this.prefRecords_ = {};
  this.globalObservers_ = [];

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
 *
 * @param {string} name The name of the new preference (used for indexing).
 * @param {*} defaultValue The default value for this preference.
 * @constructor
 */
lib.PreferenceManager.Record = function(name, defaultValue) {
  this.name = name;
  this.defaultValue = defaultValue;
  this.currentValue = this.DEFAULT_VALUE;
  this.observers = [];
};

/**
 * A local copy of the DEFAULT_VALUE constant to make it less verbose.
 *
 * @type {symbol}
 */
lib.PreferenceManager.Record.prototype.DEFAULT_VALUE =
    lib.PreferenceManager.prototype.DEFAULT_VALUE;

/**
 * Register a callback to be invoked when this preference changes.
 *
 * @param {function(string, string, !lib.PreferenceManager)} observer The
 *     function to invoke.  It will receive the new value, the name of the
 *     preference, and a reference to the PreferenceManager as parameters.
 */
lib.PreferenceManager.Record.prototype.addObserver = function(observer) {
  this.observers.push(observer);
};

/**
 * Unregister an observer callback.
 *
 * @param {function(string, string, !lib.PreferenceManager)} observer A
 *     previously registered callback.
 */
lib.PreferenceManager.Record.prototype.removeObserver = function(observer) {
  var i = this.observers.indexOf(observer);
  if (i >= 0) {
    this.observers.splice(i, 1);
  }
};

/**
 * Fetch the value of this preference.
 *
 * @return {*} The value for this preference.
 */
lib.PreferenceManager.Record.prototype.get = function() {
  if (this.currentValue === this.DEFAULT_VALUE) {
    if (/^(string|number)$/.test(typeof this.defaultValue)) {
      return this.defaultValue;
    }

    if (typeof this.defaultValue == 'object') {
      // We want to return a COPY of the default value so that users can
      // modify the array or object without changing the default value.
      return JSON.parse(JSON.stringify(this.defaultValue));
    }

    return this.defaultValue;
  }

  return this.currentValue;
};

/**
 * Stop this preference manager from tracking storage changes.
 *
 * Call this if you're going to swap out one preference manager for another so
 * that you don't get notified about irrelevant changes.
 */
lib.PreferenceManager.prototype.deactivate = function() {
  if (!this.isActive_) {
    throw new Error('Not activated');
  }

  this.isActive_ = false;
  this.storage.removeObserver(this.storageObserver_);
};

/**
 * Start tracking storage changes.
 *
 * If you previously deactivated this preference manager, you can reactivate it
 * with this method.  You don't need to call this at initialization time, as
 * it's automatically called as part of the constructor.
 */
lib.PreferenceManager.prototype.activate = function() {
  if (this.isActive_) {
    throw new Error('Already activated');
  }

  this.isActive_ = true;
  this.storage.addObserver(this.storageObserver_);
};

/**
 * Read the backing storage for these preferences.
 *
 * You should do this once at initialization time to prime the local cache
 * of preference values.  The preference manager will monitor the backing
 * storage for changes, so you should not need to call this more than once.
 *
 * This function recursively reads storage for all child preference managers as
 * well.
 *
 * This function is asynchronous, if you need to read preference values, you
 * *must* wait for the callback.
 *
 * @param {function()=} callback Optional function to invoke when the read
 *     has completed.
 */
lib.PreferenceManager.prototype.readStorage = function(callback = undefined) {
  var pendingChildren = 0;

  function onChildComplete() {
    if (--pendingChildren == 0 && callback) {
      callback();
    }
  }

  var keys = Object.keys(this.prefRecords_).map((el) => this.prefix + el);

  if (this.trace) {
    console.log('Preferences read: ' + this.prefix);
  }

  this.storage.getItems(keys, function(items) {
      var prefixLength = this.prefix.length;

      for (var key in items) {
        var value = items[key];
        var name = key.substr(prefixLength);
        var needSync = (name in this.childLists_ &&
                        (JSON.stringify(value) !=
                         JSON.stringify(this.prefRecords_[name].currentValue)));

        this.prefRecords_[name].currentValue = value;

        if (needSync) {
          pendingChildren++;
          this.syncChildList(name, onChildComplete);
        }
      }

      if (pendingChildren == 0 && callback) {
        setTimeout(callback);
      }
    }.bind(this));
};

/**
 * Define a preference.
 *
 * This registers a name, default value, and onChange handler for a preference.
 *
 * @param {string} name The name of the preference.  This will be prefixed by
 *     the prefix of this PreferenceManager before written to local storage.
 * @param {string|number|boolean|!Object|!Array|null} value The default value of
 *     this preference.  Anything that can be represented in JSON is a valid
 *     default value.
 * @param {function(*, string, !lib.PreferenceManager)=} onChange A
 *     function to invoke when the preference changes.  It will receive the new
 *     value, the name of the preference, and a reference to the
 *     PreferenceManager as parameters.
 */
lib.PreferenceManager.prototype.definePreference = function(
    name, value, onChange = undefined) {

  var record = this.prefRecords_[name];
  if (record) {
    this.changeDefault(name, value);
  } else {
    record = this.prefRecords_[name] =
        new lib.PreferenceManager.Record(name, value);
  }

  if (onChange) {
    record.addObserver(onChange);
  }
};

/**
 * Define multiple preferences with a single function call.
 *
 * @param {!Array<*>} defaults An array of 3-element arrays.  Each three element
 *     array should contain the [key, value, onChange] parameters for a
 *     preference.
 */
lib.PreferenceManager.prototype.definePreferences = function(defaults) {
  for (var i = 0; i < defaults.length; i++) {
    this.definePreference(defaults[i][0], defaults[i][1], defaults[i][2]);
  }
};

/**
 * Define an ordered list of child preferences.
 *
 * Child preferences are different from just storing an array of JSON objects
 * in that each child is an instance of a preference manager.  This means you
 * can observe changes to individual child preferences, and get some validation
 * that you're not reading or writing to an undefined child preference value.
 *
 * @param {string} listName A name for the list of children.  This must be
 *     unique in this preference manager.  The listName will become a
 *     preference on this PreferenceManager used to store the ordered list of
 *     child ids.  It is also used in get/add/remove operations to identify the
 *     list of children to operate on.
 * @param {function(!lib.PreferenceManager, string)} childFactory A function
 *     that will be used to generate instances of these children.  The factory
 *     function will receive the parent lib.PreferenceManager object and a
 *     unique id for the new child preferences.
 */
lib.PreferenceManager.prototype.defineChildren = function(
    listName, childFactory) {

  // Define a preference to hold the ordered list of child ids.
  this.definePreference(listName, [],
                        this.onChildListChange_.bind(this, listName));
  this.childFactories_[listName] = childFactory;
  this.childLists_[listName] = {};
};

/**
 * Register to observe preference changes.
 *
 * @param {string} name The name of preference you wish to observe..
 * @param {function(*, string, !lib.PreferenceManager)} observer The callback.
 */
lib.PreferenceManager.prototype.addObserver = function(name, observer) {
  if (!(name in this.prefRecords_)) {
    throw new Error(`Unknown preference: ${name}`);
  }

  this.prefRecords_[name].addObserver(observer);
};

/**
 * Register to observe preference changes.
 *
 * @param {?function()} global A callback that will happen for every preference.
 *     Pass null if you don't need one.
 * @param {!Object} map A map of preference specific callbacks.  Pass null if
 *     you don't need any.
 */
lib.PreferenceManager.prototype.addObservers = function(global, map) {
  if (global && typeof global != 'function') {
    throw new Error('Invalid param: globals');
  }

  if (global) {
    this.globalObservers_.push(global);
  }

  if (!map) {
    return;
  }

  for (var name in map) {
    this.addObserver(name, map[name]);
  }
};

/**
 * Remove preference observer.
 *
 * @param {string} name The name of preference you wish to stop observing.
 * @param {function(*, string, !lib.PreferenceManager)} observer The observer to
 *     remove.
 */
lib.PreferenceManager.prototype.removeObserver = function(name, observer) {
  if (!(name in this.prefRecords_)) {
    throw new Error(`Unknown preference: ${name}`);
  }

  this.prefRecords_[name].removeObserver(observer);
};

/**
 * Dispatch the change observers for all known preferences.
 *
 * It may be useful to call this after readStorage completes, in order to
 * get application state in sync with user preferences.
 *
 * This can be used if you've changed a preference manager out from under
 * a live object, for example when switching to a different prefix.
 */
lib.PreferenceManager.prototype.notifyAll = function() {
  for (var name in this.prefRecords_) {
    this.notifyChange_(name);
  }
};

/**
 * Notify the change observers for a given preference.
 *
 * @param {string} name The name of the preference that changed.
 */
lib.PreferenceManager.prototype.notifyChange_ = function(name) {
  var record = this.prefRecords_[name];
  if (!record) {
    throw new Error('Unknown preference: ' + name);
  }

  var currentValue = record.get();

  for (var i = 0; i < this.globalObservers_.length; i++) {
    this.globalObservers_[i](name, currentValue);
  }

  for (var i = 0; i < record.observers.length; i++) {
    record.observers[i](currentValue, name, this);
  }
};

/**
 * Create a new child PreferenceManager for the given child list.
 *
 * The optional hint parameter is an opaque prefix added to the auto-generated
 * unique id for this child.  Your child factory can parse out the prefix
 * and use it.
 *
 * @param {string} listName The child list to create the new instance from.
 * @param {?string=} hint Optional hint to include in the child id.
 * @param {string=} id Optional id to override the generated id.
 * @return {!lib.PreferenceManager} The new child preference manager.
 */
lib.PreferenceManager.prototype.createChild = function(
    listName, hint = undefined, id = undefined) {
  var ids = this.get(listName);

  if (id) {
    if (ids.indexOf(id) != -1) {
      throw new Error('Duplicate child: ' + listName + ': ' + id);
    }

  } else {
    // Pick a random, unique 4-digit hex identifier for the new profile.
    while (!id || ids.indexOf(id) != -1) {
      id = lib.f.randomInt(1, 0xffff).toString(16);
      id = lib.f.zpad(id, 4);
      if (hint) {
        id = `${hint}:${id}`;
      }
    }
  }

  var childManager = this.childFactories_[listName](this, id);
  childManager.trace = this.trace;
  childManager.resetAll();

  this.childLists_[listName][id] = childManager;

  ids.push(id);
  this.set(listName, ids, undefined, !this.isImportingJson_);

  return childManager;
};

/**
 * Remove a child preferences instance.
 *
 * Removes a child preference manager and clears any preferences stored in it.
 *
 * @param {string} listName The name of the child list containing the child to
 *     remove.
 * @param {string} id The child ID.
 */
lib.PreferenceManager.prototype.removeChild = function(listName, id) {
  var prefs = this.getChild(listName, id);
  prefs.resetAll();

  var ids = this.get(listName);
  var i = ids.indexOf(id);
  if (i != -1) {
    ids.splice(i, 1);
    this.set(listName, ids, undefined, !this.isImportingJson_);
  }

  delete this.childLists_[listName][id];
};

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
lib.PreferenceManager.prototype.getChild = function(
    listName, id, defaultValue = undefined) {
  if (!(listName in this.childLists_)) {
    throw new Error('Unknown child list: ' + listName);
  }

  var childList = this.childLists_[listName];
  if (!(id in childList)) {
    if (defaultValue === undefined) {
      throw new Error('Unknown "' + listName + '" child: ' + id);
    }

    return defaultValue;
  }

  return childList[id];
};

/**
 * Synchronize a list of child PreferenceManagers instances with the current
 * list stored in prefs.
 *
 * This will instantiate any missing managers and read current preference values
 * from storage.  Any active managers that no longer appear in preferences will
 * be deleted.
 *
 * @param {string} listName The child list to synchronize.
 * @param {function()=} callback Function to invoke when the sync finishes.
 */
lib.PreferenceManager.prototype.syncChildList = function(
    listName, callback = undefined) {
  var pendingChildren = 0;
  function onChildStorage() {
    if (--pendingChildren == 0 && callback) {
      callback();
    }
  }

  // The list of child ids that we *should* have a manager for.
  var currentIds = this.get(listName);

  // The known managers at the start of the sync.  Any manager still in this
  // list at the end should be discarded.
  var oldIds = Object.keys(this.childLists_[listName]);

  for (var i = 0; i < currentIds.length; i++) {
    var id = currentIds[i];

    var managerIndex = oldIds.indexOf(id);
    if (managerIndex >= 0) {
      oldIds.splice(managerIndex, 1);
    }

    if (!this.childLists_[listName][id]) {
      var childManager = this.childFactories_[listName](this, id);
      if (!childManager) {
        console.warn('Unable to restore child: ' + listName + ': ' + id);
        continue;
      }

      childManager.trace = this.trace;
      this.childLists_[listName][id] = childManager;
      pendingChildren++;
      childManager.readStorage(onChildStorage);
    }
  }

  for (var i = 0; i < oldIds.length; i++) {
    delete this.childLists_[listName][oldIds[i]];
  }

  if (!pendingChildren && callback) {
    setTimeout(callback);
  }
};

/**
 * Reset a preference to its default state.
 *
 * This will dispatch the onChange handler if the preference value actually
 * changes.
 *
 * @param {string} name The preference to reset.
 */
lib.PreferenceManager.prototype.reset = function(name) {
  var record = this.prefRecords_[name];
  if (!record) {
    throw new Error('Unknown preference: ' + name);
  }

  this.storage.removeItem(this.prefix + name);

  if (record.currentValue !== this.DEFAULT_VALUE) {
    record.currentValue = this.DEFAULT_VALUE;
    this.notifyChange_(name);
  }
};

/**
 * Reset all preferences back to their default state.
 */
lib.PreferenceManager.prototype.resetAll = function() {
  var changed = [];

  for (var listName in this.childLists_) {
    var childList = this.childLists_[listName];
    for (var id in childList) {
      childList[id].resetAll();
    }
  }

  for (var name in this.prefRecords_) {
    if (this.prefRecords_[name].currentValue !== this.DEFAULT_VALUE) {
      this.prefRecords_[name].currentValue = this.DEFAULT_VALUE;
      changed.push(name);
    }
  }

  var keys = Object.keys(this.prefRecords_).map(function(el) {
      return this.prefix + el;
  }.bind(this));

  this.storage.removeItems(keys);

  changed.forEach(this.notifyChange_.bind(this));
};

/**
 * Return true if two values should be considered not-equal.
 *
 * If both values are the same scalar type and compare equal this function
 * returns false (no difference), otherwise return true.
 *
 * This is used in places where we want to check if a preference has changed.
 * Rather than take the time to compare complex values we just consider them
 * to always be different.
 *
 * @param {*} a A value to compare.
 * @param {*} b A value to compare.
 * @return {boolean} Whether the two are not equal.
 */
lib.PreferenceManager.prototype.diff = function(a, b) {
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
      return true;
    }
  }

  // Do a normal compare for primitive types.
  return a !== b;
};

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
lib.PreferenceManager.prototype.changeDefault = function(name, newValue) {
  var record = this.prefRecords_[name];
  if (!record) {
    throw new Error('Unknown preference: ' + name);
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
};

/**
 * Change the default value of multiple preferences.
 *
 * @param {!Object} map A map of name -> value pairs specifying the new default
 *     values.
 */
lib.PreferenceManager.prototype.changeDefaults = function(map) {
  for (var key in map) {
    this.changeDefault(key, map[key]);
  }
};

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
lib.PreferenceManager.prototype.set = function(
    name, newValue, onComplete = undefined, saveToStorage = true) {
  var record = this.prefRecords_[name];
  if (!record) {
    throw new Error('Unknown preference: ' + name);
  }

  var oldValue = record.get();

  if (!this.diff(oldValue, newValue)) {
    return Promise.resolve();
  }

  if (this.diff(record.defaultValue, newValue)) {
    record.currentValue = newValue;
    if (saveToStorage) {
      this.storage.setItem(this.prefix + name, newValue, onComplete);
    }
  } else {
    record.currentValue = this.DEFAULT_VALUE;
    if (saveToStorage) {
      this.storage.removeItem(this.prefix + name, onComplete);
    }
  }

  // We need to manually send out the notification on this instance.  If we
  // The storage event won't fire a notification because we've already changed
  // the currentValue, so it won't see a difference.  If we delayed changing
  // currentValue until the storage event, a pref read immediately after a write
  // would return the previous value.
  //
  // The notification is async so clients don't accidentally depend on
  // a synchronous notification.
  return Promise.resolve().then(() => {
    this.notifyChange_(name);
  });
};

/**
 * Get the value of a preference.
 *
 * @param {string} name The preference to get.
 * @return {*} The preference's value.
 */
lib.PreferenceManager.prototype.get = function(name) {
  var record = this.prefRecords_[name];
  if (!record) {
    throw new Error('Unknown preference: ' + name);
  }

  return record.get();
};

/**
 * Get the default value of a preference.
 *
 * @param {string} name The preference to get.
 * @return {*} The preference's default value.
 */
lib.PreferenceManager.prototype.getDefault = function(name) {
  const record = this.prefRecords_[name];
  if (!record) {
    throw new Error(`Unknown preference: ${name}`);
  }

  return record.defaultValue;
};

/**
 * Get the boolean value of a preference.
 *
 * @param {string} name The preference to get.
 * @return {boolean}
 */
lib.PreferenceManager.prototype.getBoolean = function(name) {
  const result = this.get(name);
  lib.assert(typeof result == 'boolean');
  return result;
};

/**
 * Get the number value of a preference.
 *
 * @param {string} name The preference to get.
 * @return {number}
 */
lib.PreferenceManager.prototype.getNumber = function(name) {
  const result = this.get(name);
  lib.assert(typeof result == 'number');
  return result;
};

/**
 * Get the string value of a preference.
 *
 * @param {string} name The preference to get.
 * @return {string}
 */
lib.PreferenceManager.prototype.getString = function(name) {
  const result = this.get(name);
  lib.assert(typeof result == 'string');
  return result;
};

/**
 * Return all non-default preferences as a JSON object.
 *
 * This includes any nested preference managers as well.
 *
 * @return {!Object} The JSON preferences.
 */
lib.PreferenceManager.prototype.exportAsJson = function() {
  var rv = {};

  for (var name in this.prefRecords_) {
    if (name in this.childLists_) {
      rv[name] = [];
      var childIds = this.get(name);
      for (var i = 0; i < childIds.length; i++) {
        var id = childIds[i];
        rv[name].push({id: id, json: this.getChild(name, id).exportAsJson()});
      }

    } else {
      var record = this.prefRecords_[name];
      if (record.currentValue != this.DEFAULT_VALUE) {
        rv[name] = record.currentValue;
      }
    }
  }

  return rv;
};

/**
 * Import a JSON blob of preferences previously generated with exportAsJson.
 *
 * This will create nested preference managers as well.
 *
 * @param {!Object} json The JSON settings to import.
 * @param {function()=} onComplete Callback when all imports have finished.
 */
lib.PreferenceManager.prototype.importFromJson = function(json, onComplete) {
  this.isImportingJson_ = true;

  let pendingWrites = 0;
  const onWriteStorage = () => {
    if (--pendingWrites < 1) {
      if (onComplete) {
        onComplete();
      }

      // We've delayed updates to the child arrays, so flush them now.
      for (let name in json) {
        if (name in this.childLists_) {
          this.set(name, this.get(name));
        }
      }

      this.isImportingJson_ = false;
    }
  };

  for (var name in json) {
    if (name in this.childLists_) {
      var childList = json[name];
      for (var i = 0; i < childList.length; i++) {
        var id = childList[i].id;

        var childPrefManager = this.childLists_[name][id];
        if (!childPrefManager) {
          childPrefManager = this.createChild(name, null, id);
        }

        childPrefManager.importFromJson(childList[i].json, onWriteStorage);
        pendingWrites++;
      }

    } else {
      // The set is synchronous.
      this.set(name, json[name]);
    }
  }

  // If we didn't update any children, no async work has been queued, so make
  // the completion callback directly.
  if (pendingWrites == 0 && onComplete) {
    onComplete();
  }
};

/**
 * Called when one of the child list preferences changes.
 *
 * @param {string} listName The child list to synchronize.
 */
lib.PreferenceManager.prototype.onChildListChange_ = function(listName) {
  this.syncChildList(listName);
};

/**
 * Called when a key in the storage changes.
 *
 * @param {!Object} map Dictionary of changed settings.
 */
lib.PreferenceManager.prototype.onStorageChange_ = function(map) {
  for (var key in map) {
    if (this.prefix) {
      if (key.lastIndexOf(this.prefix, 0) != 0) {
        continue;
      }
    }

    var name = key.substr(this.prefix.length);

    if (!(name in this.prefRecords_)) {
      // Sometimes we'll get notified about prefs that are no longer defined.
      continue;
    }

    var record = this.prefRecords_[name];

    var newValue = map[key].newValue;
    var currentValue = record.currentValue;
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
};
