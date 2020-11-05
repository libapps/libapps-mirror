// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * PreferenceManager subclass managing global NaSSH preferences.
 *
 * This is currently just an ordered list of known connection profiles.
 *
 * @param {!lib.Storage=} storage
 * @constructor
 * @extends {lib.PreferenceManager}
 */
nassh.PreferenceManager = function(storage = undefined) {
  if (!storage) {
    storage = new lib.Storage.Chrome(chrome.storage.sync);
  }
  lib.PreferenceManager.call(this, storage, '/nassh/');

  this.defineChildren('profile-ids', function(parent, id) {
    return new nassh.ProfilePreferenceManager(parent, id);
  });

  this.definePreferences([
    /**
     * The last version we showed release notes for.
     */
    ['welcome/notes-version', ''],

    /**
     * How many times we've shown the current release notes.
     */
    ['welcome/show-count', 0],
  ]);
};

nassh.PreferenceManager.prototype =
    Object.create(lib.PreferenceManager.prototype);
/** @override */
nassh.PreferenceManager.constructor = nassh.PreferenceManager;

/** @return {!nassh.PreferenceManager} */
nassh.PreferenceManager.prototype.createProfile = function() {
  return /** @type {!nassh.PreferenceManager} */ (
      this.createChild('profile-ids'));
};

/** @param {string} id */
nassh.PreferenceManager.prototype.removeProfile = function(id) {
  this.removeChild('profile-ids', id);
};

/**
 * @param {string} id
 * @return {!nassh.PreferenceManager}
 */
nassh.PreferenceManager.prototype.getProfile = function(id) {
  return /** @type {!nassh.PreferenceManager} */ (
      this.getChild('profile-ids', id));
};

/**
 * lib.PreferenceManager subclass managing per-connection preferences.
 *
 * @param {!lib.PreferenceManager} parent
 * @param {string} id
 * @constructor
 * @extends {lib.PreferenceManager}
 */
nassh.ProfilePreferenceManager = function(parent, id) {
  lib.PreferenceManager.call(this, parent.storage,
                             '/nassh/profiles/' + id);

  this.id = id;

  this.definePreferences([
    /**
     * The free-form description of this connection profile.
     */
    ['description', ''],

    /**
     * The username.
     */
    ['username', ''],

    /**
     * The hostname or IP address.
     */
    ['hostname', ''],

    /**
     * The port, or null to use the default port.
     */
    ['port', null],

    /**
     * Options string for nassh itself (e.g. relay settings).
     */
    ['nassh-options', ''],

    /**
     * The private key file to use as the identity for this extension.
     *
     * Must be relative to the /.ssh/ directory.
     */
    ['identity', ''],

    /**
     * The argument string to pass to the ssh executable.
     *
     * Use '--' to separate ssh arguments from the target command/arguments.
     */
    ['argstr', ''],

    /**
     * The terminal profile to use for this connection.
     */
    ['terminal-profile', ''],

    /**
     * The base path used when mounting via SFTP.
     */
    ['mount-path', ''],
  ]);
};

nassh.ProfilePreferenceManager.prototype =
    Object.create(lib.PreferenceManager.prototype);
/** @override */
nassh.ProfilePreferenceManager.constructor = nassh.ProfilePreferenceManager;

/**
 * Settings that are not synced between systems.
 *
 * Most code should use nassh.PreferenceManager instead which syncs user
 * settings between systems.
 *
 * @param {!lib.Storage=} storage
 * @constructor
 * @extends {lib.PreferenceManager}
 */
nassh.LocalPreferenceManager = function(storage = undefined) {
  if (!storage) {
    storage = new lib.Storage.Local();
  }
  lib.PreferenceManager.call(this, storage, '/nassh/');

  this.definePreferences([
    /* The last profile the user selected. */
    ['connectDialog/lastProfileId', ''],

    /* How many times we've shown the migration message. */
    ['migrate/showCount', 0],
  ]);

  this.defineChildren('profile-ids', function(parent, id) {
    return new nassh.ProfileLocalPreferenceManager(parent, id);
  });
};

nassh.LocalPreferenceManager.prototype =
    Object.create(lib.PreferenceManager.prototype);
/** @override */
nassh.LocalPreferenceManager.constructor = nassh.LocalPreferenceManager;

/**
 * Sync remote & local profiles to simplify code.
 *
 * @param {!nassh.PreferenceManager} remotePrefs The remote set of profiles to
 *     sync against.
 */
nassh.LocalPreferenceManager.prototype.syncProfiles = function(remotePrefs) {
  const localIds = new Set(
      /** @type {!Array<string>} */ (this.get('profile-ids')));
  const remoteIds = new Set(
      /** @type {!Array<string>} */ (remotePrefs.get('profile-ids')));

  // Delete any local prefs that no longer exist.
  localIds.forEach((id) => {
    if (!remoteIds.has(id)) {
      this.removeProfile(id);
    }
  });

  // Initialize local perfs that have shown up from the remote.
  remoteIds.forEach((id) => {
    if (!localIds.has(id)) {
      this.createProfile(id);
    }
  });
};

/**
 * Create a new profile child.
 *
 * @param {string=} id The specific profile id to use.
 * @return {!nassh.LocalPreferenceManager}
 */
nassh.LocalPreferenceManager.prototype.createProfile = function(
    id = undefined) {
  return /** @type {!nassh.LocalPreferenceManager} */ (
      this.createChild('profile-ids', undefined, id));
};

/** @param {string} id */
nassh.LocalPreferenceManager.prototype.removeProfile = function(id) {
  this.removeChild('profile-ids', id);
};

/**
 * @param {string} id
 * @return {!nassh.LocalPreferenceManager}
 */
nassh.LocalPreferenceManager.prototype.getProfile = function(id) {
  return /** @type {!nassh.LocalPreferenceManager} */ (
      this.getChild('profile-ids', id));
};

/**
 * lib.PreferenceManager subclass managing per-connection preferences.
 *
 * @param {!lib.PreferenceManager} parent
 * @param {string} id
 * @constructor
 * @extends {lib.PreferenceManager}
 */
nassh.ProfileLocalPreferenceManager = function(parent, id) {
  lib.PreferenceManager.call(this, parent.storage, `/nassh/profiles/${id}`);

  this.id = id;

  this.definePreferences([
    ['win/top', '0'],
    ['win/left', '0'],
    ['win/height', '600'],
    ['win/width', '900'],
    ['win/state', 'normal'],
  ]);
};

nassh.ProfileLocalPreferenceManager.prototype =
    Object.create(lib.PreferenceManager.prototype);
/** @override */
nassh.ProfileLocalPreferenceManager.constructor =
    nassh.ProfileLocalPreferenceManager;
