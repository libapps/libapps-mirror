// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../../libdot/index.js';

/**
 * See whether a particular storage has "high" quota limits.
 *
 * Some storage backends (notably Chrome sync storage) have quotas limits that
 * we can semi-easily run into because of how our underlying profiles store
 * their state, and how many profiles/keys we expect them to have.  Since each
 * saved connection can take up ~10 keys, and Chrome sync storage limits each
 * extension to 512 keys, some users have reported being unable to add more.
 * Similarly, Chrome sync storage limits how many keys we can write to per
 * minute (120) which makes backup restores painful.
 *
 * So we define "high" as how likely we are to run into the limits.
 *
 * @param {!lib.Storage} storage The storage to inspect.
 * @return {boolean} Whether the storage has "high" quotas.
 */
export function storageQuotasAreHigh(storage) {
  // Chrome sync storage quotas are a bit too low for us.
  if (storage instanceof lib.Storage.Chrome) {
    return storage.storage_?.MAX_ITEMS === undefined;
  }

  // All other storage methods are known to be fine.
  return true;
}

/**
 * PreferenceManager subclass managing global NaSSH preferences.
 *
 * These are synced between devices.
 */
export class PreferenceManager extends lib.PreferenceManager {
  /**
   * @param {!lib.Storage} storage
   */
  constructor(storage) {
    super(storage, '/nassh/');

    this.defineChildren('profile-ids', function(parent, id) {
      return new ProfilePreferenceManager(parent, id);
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
  }

  /** @return {!ProfilePreferenceManager} */
  createProfile() {
    return /** @type {!ProfilePreferenceManager} */ (
        this.createChild('profile-ids'));
  }

  /** @param {string} id */
  removeProfile(id) {
    this.removeChild('profile-ids', id);
  }

  /**
   * @param {string} id
   * @return {!ProfilePreferenceManager}
   */
  getProfile(id) {
    return /** @type {!ProfilePreferenceManager} */ (
        this.getChild('profile-ids', id));
  }
}

/**
 * lib.PreferenceManager subclass managing per-connection preferences.
 */
export class ProfilePreferenceManager extends lib.PreferenceManager {
  /**
   * @param {!lib.PreferenceManager} parent
   * @param {string} id
   */
  constructor(parent, id) {
    super(parent.storage, `/nassh/profiles/${id}`, {
      // Condense only if underlying storage has quota limits.
      finegrain: storageQuotasAreHigh(parent.storage),
    });

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
  }
}

/**
 * Settings that are not synced between systems.
 *
 * Most code should use PreferenceManager instead which syncs user
 * settings between systems.
 */
export class LocalPreferenceManager extends lib.PreferenceManager {
  /**
   * @param {!lib.Storage=} storage
   */
  constructor(storage = undefined) {
    if (!storage) {
      // If we have access to Chrome local storage, use it.  This allows sharing
      // state between service workers & normal connections.  However, on the
      // open web, we want to fallback to window.localStorage.
      storage = globalThis.chrome?.storage?.local ?
          new lib.Storage.Chrome(chrome.storage.local) :
          new lib.Storage.Local();
    }
    super(storage, '/nassh/');

    this.definePreferences([
      /* The last profile the user selected. */
      ['connectDialog/lastProfileId', ''],

      /**
       * Whether permission to track performance metrics was granted (true) or
       * or denied (false). Null if user has not been prompted.
       */
      ['goog-metrics-reporter-permission', null],
    ]);

    this.defineChildren('profile-ids', function(parent, id) {
      return new ProfileLocalPreferenceManager(parent, id);
    });
  }

  /**
   * Sync remote & local profiles to simplify code.
   *
   * @param {!PreferenceManager} remotePrefs The remote set of profiles to sync
   *     against.
   */
  syncProfiles(remotePrefs) {
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
  }

  /**
   * Create a new profile child.
   *
   * @param {string=} id The specific profile id to use.
   * @return {!ProfileLocalPreferenceManager}
   */
  createProfile(id = undefined) {
    return /** @type {!ProfileLocalPreferenceManager} */ (
        this.createChild('profile-ids', undefined, id));
  }

  /** @param {string} id */
  removeProfile(id) {
    this.removeChild('profile-ids', id);
  }

  /**
   * @param {string} id
   * @return {!ProfileLocalPreferenceManager}
   */
  getProfile(id) {
    return /** @type {!ProfileLocalPreferenceManager} */ (
        this.getChild('profile-ids', id));
  }
}

/**
 * lib.PreferenceManager subclass managing per-connection preferences.
 */
export class ProfileLocalPreferenceManager extends lib.PreferenceManager {
  /**
   * @param {!lib.PreferenceManager} parent
   * @param {string} id
   */
  constructor(parent, id) {
    super(parent.storage, `/nassh/profiles/${id}`);

    this.id = id;

    this.definePreferences([
      ['win/top', '0'],
      ['win/left', '0'],
      ['win/height', '600'],
      ['win/width', '900'],
      ['win/state', 'normal'],
    ]);
  }
}
