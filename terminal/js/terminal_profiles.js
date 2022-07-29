// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview helper functions for nassh and vsh profiles.
 */

/**
 * Profile type.
 *
 * @readonly
 * @enum {string}
 */
export const ProfileType = {
  HTERM: 'hterm',
  NASSH: 'nassh',
  VSH: 'vsh',
};

/**
 * @param {!ProfileType} profileType
 * @param {string} profileId
 * @param {string} name
 * @return {string}
 */
function getProfileKey(profileType, profileId, name) {
  const result = `/${profileType}/profiles/${profileId}/${name}`;
  if (!profileId || !name) {
    throw new Error(`Empty profileId or name in ${result}`);
  }
  return result;
}

/**
 * @param {!ProfileType} profileType
 * @return {!Promise<!Array<string>>}
 */
export async function getProfileIds(profileType) {
  const profileIds = /** @type {?Array<string>}*/ (
      await window.storage.getItem(`/${profileType}/profile-ids`));
  return profileIds ?? [];
}

/**
 * @param {!ProfileType} profileType
 * @param {!Array<string>} profileIds
 * @return {!Promise<void>}
 */
export async function setProfileIds(profileType, profileIds) {
  await window.storage.setItem(`/${profileType}/profile-ids`, profileIds);
}

/**
 * Get profile values. The return value is an array in the same
 * order as the param `names`.
 *
 * @param {!ProfileType} profileType
 * @param {string} profileId
 * @param {!Array<string>} names
 * @param {*} defaultValue Any missing values are replaced with this.
 * @return {!Promise<!Array<*>>}
 */
export async function getProfileValues(
    profileType, profileId, names, defaultValue) {
  const keys = names.map((x) => getProfileKey(profileType, profileId, x));
  const rv = await window.storage.getItems(keys);
  return keys.map((k) => rv[k] ?? defaultValue);
}

/**
 * Set profile values from an object.
 *
 * @param {!ProfileType} profileType
 * @param {string} profileId
 * @param {!Object} values
 */
export async function setProfileValues(profileType, profileId, values) {
  const values2 = {};
  for (const [name, value] of Object.entries(values)) {
    values2[getProfileKey(profileType, profileId, name)] = value;
  }
  await window.storage.setItems(values2);
}

/**
 * Clear all storage items for current profile, and optionally remove the
 * profile from the list of `/${profileType}/profile-ids`.
 *
 * @param {!ProfileType} profileType
 * @param {string} profileId profile to delete.
 * @param {boolean=} deleteFromProfileIds
 */
export async function deleteProfile(
    profileType, profileId, deleteFromProfileIds = true) {
  if (deleteFromProfileIds) {
    await setProfileIds(
        profileType,
        (await getProfileIds(profileType)).filter((id) => id !== profileId),
    );
  }
  const prefix = `/${profileType}/profiles/${profileId}`;
  window.storage.removeItems(
      Object.keys(await window.storage.getItems(null))
          .filter((key) => key.startsWith(prefix)),
  );
}

/**
 * Clean up any vsh sync prefs.
 *
 * @return {!Promise<void>}
 */
export async function cleanupVshSyncPrefs() {
  await window.storage.removeItems(
      Object.keys(await window.storage.getItems(null)).filter((key) => {
        return key.split('/')[1] === 'vsh';
      }));
}

/**
 * Reset all NASSH and VSH profiles using terminalProfile to use the default
 * terminal profile.
 *
 * @param {string} terminalProfile
 * @return {!Promise<void>}
 */
export async function resetTerminalProfileToDefault(terminalProfile) {
  // Reset nassh.
  const items = await window.storage.getItems(null);
  await window.storage.removeItems(
      Object.entries(items).filter(([key, value]) => {
        const parts = key.split('/');
        return parts[1] === ProfileType.NASSH && parts[2] === 'profiles' &&
             parts[4] === 'terminal-profile' && value === terminalProfile;
      }).map(([key, value]) => key));

  // Reset vsh.
  const profiles = getVshProfiles();
  for (const p in profiles) {
    const profile = profiles[p];
    if (profile['terminal-profile'] === terminalProfile) {
      delete profile['terminal-profile'];
    }
  }
  setVshProfiles(profiles);
}

/**
 * Get VSH profiles.  VSH profiles are stored in window.localStorage as JSON.
 *
 * @return {!Object}
 */
export function getVshProfiles() {
  let profiles = {};
  let json = '';
  try {
    json = window.localStorage.getItem('vsh-profiles') || '';
    profiles = JSON.parse(json) || {};
  } catch (e) {
    console.error(`Error parsing localStorage vsh-profiles: ${json}`, e);
  }
  return /** @type {!Object} */ (profiles);
}

/**
 * Update VSH profiles.
 *
 * @param {!Object} profiles
 */
export function setVshProfiles(profiles) {
  window.localStorage.setItem('vsh-profiles', JSON.stringify(profiles));
}
