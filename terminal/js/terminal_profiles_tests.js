// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {ProfileType, cleanupLostValues, deleteProfile, getProfileIds,
  getProfileValues, setProfileIds, setProfileValues}
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
      '/vsh/profile-ids': ['p1', 'p2', 'p3'],
      '/vsh/profiles/p1/k1': 'p1k1',
      '/vsh/profiles/p1/k2': 'p1k2',
      '/vsh/profiles/p2/k1': 'p2k1',
      '/vsh/profiles/p2/k3': 'p2k3',
      '/vsh/profiles/p3/k4': 'p3k4',
    });

    // getProfileIds()
    assert.deepEqual(await getProfileIds(ProfileType.VSH), ['p1', 'p2', 'p3']);
    const names = ['k1', 'k2', 'k3'];

    // getProfileValues()
    assert.deepEqual(
        await getProfileValues(ProfileType.VSH, 'p1', names, 'x'),
        ['p1k1', 'p1k2', 'x']);
    assert.deepEqual(
        await getProfileValues(ProfileType.VSH, 'p2', names, null),
        ['p2k1', null, 'p2k3']);
    assert.deepEqual(
        await getProfileValues(ProfileType.VSH, 'p3', names, undefined),
        [undefined, undefined, undefined]);

    // setProfileIds()
    await setProfileIds(ProfileType.VSH, ['p1', 'p2']);
    assert.deepEqual(await getProfileIds(ProfileType.VSH), ['p1', 'p2']);
    assert.deepEqual(await window.storage.getItems(), {
      '/vsh/profile-ids': ['p1', 'p2'],
      '/vsh/profiles/p1/k1': 'p1k1',
      '/vsh/profiles/p1/k2': 'p1k2',
      '/vsh/profiles/p2/k1': 'p2k1',
      '/vsh/profiles/p2/k3': 'p2k3',
      '/vsh/profiles/p3/k4': 'p3k4',
    });

    // cleanupLostValues()
    await cleanupLostValues(ProfileType.VSH);
    assert.deepEqual(await window.storage.getItems(), {
      '/vsh/profile-ids': ['p1', 'p2'],
      '/vsh/profiles/p1/k1': 'p1k1',
      '/vsh/profiles/p1/k2': 'p1k2',
      '/vsh/profiles/p2/k1': 'p2k1',
      '/vsh/profiles/p2/k3': 'p2k3',
    });

    // setProfileValues()
    await setProfileValues(ProfileType.VSH, 'p1', {k1: 'p1k11', k3:'p1k33'});
    assert.deepEqual(
        await getProfileValues(ProfileType.VSH, 'p1', names, undefined),
        ['p1k11', 'p1k2', 'p1k33']);

    // deleteProfile()
    await deleteProfile(ProfileType.VSH, 'p1', false);
    assert.deepEqual(await getProfileIds(ProfileType.VSH), ['p1', 'p2']);
    assert.deepEqual(
        await getProfileValues(ProfileType.VSH, 'p1', names, undefined),
        [undefined, undefined, undefined]);
    await setProfileValues(ProfileType.VSH, 'p1', {k1: 'p1k1'});
    assert.deepEqual(await getProfileIds(ProfileType.VSH), ['p1', 'p2']);
    assert.deepEqual(
        await getProfileValues(ProfileType.VSH, 'p1', names, undefined),
        ['p1k1', undefined, undefined]);
    await deleteProfile(ProfileType.VSH, 'p1', true);
    assert.deepEqual(await getProfileIds(ProfileType.VSH), ['p2']);
    assert.deepEqual(
        await getProfileValues(ProfileType.VSH, 'p1', names, undefined),
        [undefined, undefined, undefined]);
  });
});
