// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from './deps_local.concat.js';

import {ProfileType, cleanupVshSyncPrefs, deleteProfile, getProfileIds,
  getProfileValues, getVshProfiles, resetTerminalProfileToDefault,
  setProfileIds, setProfileValues, setVshProfiles}
  from './terminal_profiles.js';

describe('terminal_profiles.js', function() {
  beforeEach(async function() {
    window.storage = new lib.Storage.Memory();
  });

  afterEach(function() {
    delete window.storage;
  });

  it('gets-sets-and-deletes-profiles', async function() {
    await window.storage.setItems({
      '/hterm/profile-ids': ['p1', 'p2', 'p3'],
      '/hterm/profiles/p1/k1': 'p1k1',
      '/hterm/profiles/p1/k2': 'p1k2',
      '/hterm/profiles/p2/k1': 'p2k1',
      '/hterm/profiles/p2/k3': 'p2k3',
      '/hterm/profiles/p3/k4': 'p3k4',
    });

    // getProfileIds()
    assert.deepEqual(
      await getProfileIds(ProfileType.HTERM), ['p1', 'p2', 'p3']);
    const names = ['k1', 'k2', 'k3'];

    // getProfileValues()
    assert.deepEqual(
        await getProfileValues(ProfileType.HTERM, 'p1', names, 'x'),
        ['p1k1', 'p1k2', 'x']);
    assert.deepEqual(
        await getProfileValues(ProfileType.HTERM, 'p2', names, null),
        ['p2k1', null, 'p2k3']);
    assert.deepEqual(
        await getProfileValues(ProfileType.HTERM, 'p3', names, undefined),
        [undefined, undefined, undefined]);

    // setProfileIds()
    await setProfileIds(ProfileType.HTERM, ['p1', 'p2']);
    assert.deepEqual(await getProfileIds(ProfileType.HTERM), ['p1', 'p2']);

    // setProfileValues()
    await setProfileValues(ProfileType.HTERM, 'p1', {k1: 'p1k11', k3:'p1k33'});
    assert.deepEqual(
        await getProfileValues(ProfileType.HTERM, 'p1', names, undefined),
        ['p1k11', 'p1k2', 'p1k33']);

    // deleteProfile()
    await deleteProfile(ProfileType.HTERM, 'p1', false);
    assert.deepEqual(await getProfileIds(ProfileType.HTERM), ['p1', 'p2']);
    assert.deepEqual(
        await getProfileValues(ProfileType.HTERM, 'p1', names, undefined),
        [undefined, undefined, undefined]);
    await setProfileValues(ProfileType.HTERM, 'p1', {k1: 'p1k1'});
    assert.deepEqual(await getProfileIds(ProfileType.HTERM), ['p1', 'p2']);
    assert.deepEqual(
        await getProfileValues(ProfileType.HTERM, 'p1', names, undefined),
        ['p1k1', undefined, undefined]);
    await deleteProfile(ProfileType.HTERM, 'p1', true);
    assert.deepEqual(await getProfileIds(ProfileType.HTERM), ['p2']);
    assert.deepEqual(
        await getProfileValues(ProfileType.HTERM, 'p1', names, undefined),
        [undefined, undefined, undefined]);

    // resetTerminalProfileToDefault()
    await window.storage.clear();
    await window.storage.setItems({
      '/nassh/profiles/p1/k1': 'p1k1',
      '/nassh/profiles/p1/terminal-profile': 'other',
      '/nassh/profiles/p2/terminal-profile': 'deleted',
    });
    setVshProfiles({
      'p1': {'terminal-profile': 'deleted'},
      'p2': {'terminal-profile': 'other'},
    });
    await resetTerminalProfileToDefault('deleted');
    assert.deepEqual(await window.storage.getItems(), {
      '/nassh/profiles/p1/k1': 'p1k1',
      '/nassh/profiles/p1/terminal-profile': 'other',
    });
    assert.deepEqual(getVshProfiles(), {
      'p1': {},
      'p2': {'terminal-profile': 'other'},
    });

    // cleanupVshSyncPrefs()
    await window.storage.clear();
    await window.storage.setItems({
      '/vsh/profile-ids': ['p1', 'p2'],
      '/vsh/profiles/p1/k1': 'p1k1',
      '/vsh/profiles/p3/k1': 'p3k1',
    });
    await cleanupVshSyncPrefs();
    assert.deepEqual(await window.storage.getItems(), {});
  });
});
