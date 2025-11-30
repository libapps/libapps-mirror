// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview nassh preference manager tests.
 */

import {lib} from '../../libdot/index.js';

import {LocalPreferenceManager,
        PreferenceManager} from './nassh_preference_manager.js';

/**
 * Check basic init/empty behavior.
 */
it('pref-manager-init', () => {
  const prefs = new PreferenceManager(new lib.Storage.Memory());

  // Default settings should work but be empty.
  assert.deepEqual([], prefs.get('profile-ids'));
  assert.equal('', prefs.get('welcome/notes-version'));
});

/**
 * Check profile handling.
 */
it('pref-manager-profiles', () => {
  const prefs = new PreferenceManager(new lib.Storage.Memory());

  // Create a profile and check its state.
  let profile = prefs.createProfile();
  assert.equal('', profile.get('description'));

  // Make sure it's registered in the ids group.
  assert.deepEqual([profile.id], prefs.get('profile-ids'));

  // Make sure we can access it.
  profile.set('username', 'root');
  profile = prefs.getProfile(profile.id);
  assert.equal('root', profile.get('username'));

  // Remove the profile.
  prefs.removeProfile(profile.id);
  assert.deepEqual([], prefs.get('profile-ids'));
});

/**
 * Check basic init/empty behavior.
 */
it('local-pref-manager-init', () => {
  const prefs = new LocalPreferenceManager(new lib.Storage.Memory());

  // Default settings should work but be empty.
  assert.deepEqual([], prefs.get('profile-ids'));
});

/**
 * Check profile handling.
 */
it('local-pref-manager-profiles', () => {
  const prefs = new LocalPreferenceManager(new lib.Storage.Memory());

  // Create a profile and check its state.
  let profile = prefs.createProfile('foo');
  assert.equal('foo', profile.id);
  assert.equal('0', profile.get('win/top'));

  // Make sure it's registered in the ids group.
  assert.deepEqual([profile.id], prefs.get('profile-ids'));

  // Make sure we can access it.
  profile.set('win/top', '100');
  profile = prefs.getProfile(profile.id);
  assert.equal('100', profile.get('win/top'));

  // Remove the profile.
  prefs.removeProfile(profile.id);
  assert.deepEqual([], prefs.get('profile-ids'));
});

/**
 * Check profile syncing.
 */
it('local-pref-manager-profiles', () => {
  const remotePrefs = new PreferenceManager(new lib.Storage.Memory());
  const localPrefs = new LocalPreferenceManager(new lib.Storage.Memory());

  // Create remote profiles.
  const rprof1 = remotePrefs.createProfile();
  const rprof2 = remotePrefs.createProfile();

  // Sync it over.
  assert.deepEqual([], localPrefs.get('profile-ids'));
  localPrefs.syncProfiles(remotePrefs);
  assert.deepEqual([rprof1.id, rprof2.id], localPrefs.get('profile-ids'));

  // Remote a remote profile & resync.
  remotePrefs.removeProfile(rprof1.id);
  localPrefs.syncProfiles(remotePrefs);
  assert.deepEqual([rprof2.id], localPrefs.get('profile-ids'));

  // Create a local profile & resync.
  localPrefs.createProfile('asdfasdf');
  localPrefs.syncProfiles(remotePrefs);
  assert.deepEqual([rprof2.id], localPrefs.get('profile-ids'));
});
