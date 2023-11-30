// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Utility code for the background page.
 */

import {hterm} from '../../hterm/index.js';

import {getSyncStorage} from './nassh.js';
import {PreferenceManager} from './nassh_preference_manager.js';

/**
 * Export the current list of nassh connections, and any hterm profiles
 * they reference.
 *
 * This is method must be given a completion callback because the hterm
 * profiles need to be loaded asynchronously.
 *
 * @return {!Promise<!Object>} Plain JS object representing the state of nassh
 *     preferences.  The object can be passed back to importPreferences.
 */
export async function exportPreferences() {
  const rv = {
    magic: 'nassh-prefs',
    version: 1,
  };

  const storage = getSyncStorage();
  const nasshPrefs = new PreferenceManager(storage);
  await nasshPrefs.readStorage();
  // Export all the connection settings.
  rv.nassh = nasshPrefs.exportAsJson();

  // Save all the profiles.
  rv.hterm = {};
  const profiles = await hterm.PreferenceManager.listProfiles(storage);
  for (const profile of profiles) {
    const prefs = new hterm.PreferenceManager(storage, profile);
    await prefs.readStorage();
    rv.hterm[profile] = prefs.exportAsJson();
  }

  return rv;
}

/**
 * Import a preferences object.
 *
 * This will not overwrite any existing preferences.
 *
 * @param {!Object} prefsObject A preferences object created with
 *     exportPreferences.
 * @return {!Promise<void>} A promise that resolves once the import completes.
 */
export function importPreferences(prefsObject) {
  if (prefsObject.magic != 'nassh-prefs') {
    throw new Error('Not a JSON object or bad value for \'magic\'.');
  }

  if (prefsObject.version != 1) {
    throw new Error(`Bad version, expected 1, got: ${prefsObject.version}`);
  }

  const storage = getSyncStorage();
  const nasshPrefs = new PreferenceManager(storage);
  return new Promise(async (resolve) => {
    // First import the nassh settings.
    await nasshPrefs.importFromJson(prefsObject.nassh);

    // Then import each hterm profile.
    for (const terminalProfile in prefsObject.hterm) {
      const prefs = new hterm.PreferenceManager(storage, terminalProfile);
      // Sync storage to prefs object so we can reset it when importing.
      await prefs.readStorage();
      await prefs.importFromJson(prefsObject.hterm[terminalProfile]);
    }

    resolve();
  });
}
