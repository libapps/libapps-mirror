// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings App Element unit tests.
 */

import {hterm, lib} from './deps_local.concat.js';

import {definePrefs} from './terminal_common.js';
import {ProfileType, setProfileIds} from './terminal_profiles.js';
import {BELL_SOUND_CONVERTER, TerminalSettingsApp}
  from './terminal_settings_app.js';

describe('terminal_settings_app.js', function() {
  beforeEach(async function() {
    window.storage = new lib.Storage.Memory();
    await setProfileIds(ProfileType.HTERM, ['default', 'red', 'green']);
    window.PreferenceManager = hterm.PreferenceManager;
    window.preferenceManager =
      new hterm.PreferenceManager(window.storage);
    definePrefs(window.preferenceManager);

    this.el = /** @type {!TerminalSettingsApp} */ (
        document.createElement('terminal-settings-app'));
    document.body.appendChild(this.el);

    await new Promise(async (resolve) => {
      while (true) {
        if (this.el.settingsProfiles_.length === 3) {
          return resolve();
        }
        await 0;
      }
    });
    await this.el.updateComplete;
  });

  afterEach(function() {
    document.body.removeChild(this.el);
    delete window.PreferenceManager;
    delete window.preferenceManager;
    delete window.storage;
  });

  it('converts-bell-sound', () => {
    const toChecked = BELL_SOUND_CONVERTER.toChecked;
    assert.isTrue(toChecked('lib-resource:hterm/audio/bell'));
    assert.isTrue(toChecked('foo'));
    assert.isFalse(toChecked(null));
    assert.isFalse(toChecked(''));

    const fromChecked = BELL_SOUND_CONVERTER.fromChecked;
    assert.equal(fromChecked(true), 'lib-resource:hterm/audio/bell');
    assert.equal(fromChecked(false), '');
  });

  it('loads-profiles-at-start', function() {
    assert.equal(3, this.el.shadowRoot.querySelectorAll(
        'terminal-settings-profile-item').length);
    assert.equal(window.preferenceManager.prefix, '/hterm/profiles/default/');
  });

  it('selects-new-profile-after-add', async function() {
    await setProfileIds(ProfileType.HTERM, ['default', 'red', 'green', 'blue']);
    this.el.shadowRoot.querySelector('terminal-settings-profile-header')
        .dispatchEvent(new CustomEvent('settings-profile-add', {
          detail: {profile: 'blue'},
        }));
    await new Promise((resolve) => {
      this.el.shadowRoot.querySelector('terminal-settings-category-selector')
          .addEventListener('click', resolve);
    });
    assert.equal(this.el.activeSettingsProfile_, 'blue');
    assert.equal(window.preferenceManager.prefix, '/hterm/profiles/blue/');
  });

  it('updates-profile-manager-profile-id-on-change', async function() {
    this.el.clickProfile_('red');
    assert.equal(window.preferenceManager.prefix, '/hterm/profiles/red/');
  });

  it('clears-background-image-local-storage-on-delete', async function() {
    window.localStorage.setItem('background-image-test', 'test');
    await this.el.onSettingsProfileDelete_(
      new CustomEvent('', {detail: {profile: 'test'}}));

    assert.isNull(window.localStorage.getItem('background-image-test'));
  });

  it('selects-correct-profile-after-delete', async function() {
    const deleteProfile = async (profile) => {
      const profiles = this.el.settingsProfiles_.filter((p) => p !== profile);
      await setProfileIds(ProfileType.HTERM, profiles);
      await this.el.onSettingsProfileDelete_(
          new CustomEvent('', {detail: {profile}}));
    };

    // Red is selected, delete green.
    this.el.clickProfile_('red');
    await deleteProfile('green');
    assert.deepEqual(this.el.settingsProfiles_, ['default', 'red']);
    assert.equal(this.el.activeSettingsProfile_, 'red');

    // Delete red.
    await deleteProfile('red');
    assert.deepEqual(this.el.settingsProfiles_, ['default']);
    assert.equal(this.el.activeSettingsProfile_, 'default');
  });
});
