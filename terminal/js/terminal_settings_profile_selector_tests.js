// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {hterm, lib} from './deps_local.concat.js';

import {TerminalSettingsProfileSelector}
    from './terminal_settings_profile_selector.js';

describe('terminal_settings_profile_selector.js', function() {
  beforeEach(async function() {
    window.storage = new lib.Storage.Memory();
    await window.storage.setItem('/hterm/profile-ids', [
      'default', 'red', 'green']);
    window.preferenceManager =
      new hterm.PreferenceManager(window.storage);

    this.el = /** @type {!TerminalSettingsProfileSelector} */ (
        document.createElement('terminal-settings-profile-selector'));
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
    this.dropdown = this.el.shadowRoot.querySelector('terminal-dropdown');
    this.dialog = this.el.shadowRoot.querySelector('terminal-dialog');
  });

  afterEach(function() {
    document.body.removeChild(this.el);

    delete window.preferenceManager;
    delete window.storage;
  });

  it('loads-profiles-at-start', async function() {
    assert.deepEqual(this.dropdown.options, [
      {value: 'default', deletable: false},
      {value: 'red', deletable: true},
      {value: 'green', deletable: true},
    ]);
    assert.equal(window.preferenceManager.prefix, '/hterm/profiles/default/');
  });

  it('selects-new-profile-after-add', async function() {
    this.dialog.show();
    const storageUpdated = new Promise((resolve) => {
      window.storage.addObserver(resolve);
    });
    this.el.shadowRoot.querySelector('terminal-textfield').value = 'blue';
    this.dialog.accept();
    await storageUpdated;
    assert.deepEqual(this.el.settingsProfiles_, [
      {value: 'default', deletable: false},
      {value: 'red', deletable: true},
      {value: 'green', deletable: true},
      {value: 'blue', deletable: true},
    ]);
    assert.equal(this.el.activeSettingsProfile_, 'blue');
    assert.equal(window.preferenceManager.prefix, '/hterm/profiles/blue/');
  });

  it('updates-profile-manager-profile-id-on-change', async function() {
    this.dropdown.value = 'red';
    await this.el.updateComplete;
    assert.equal(window.preferenceManager.prefix, '/hterm/profiles/red/');
  });

  it('selects-correct-after-delete', async function() {
    const deleteProfile = async (index, value) => {
      this.el.deleteEvent_ = {detail: {index, option: {value}}};
      await this.el.onDeleteDialogClose_({detail: {accept: true}});
    };
    await this.el.updateComplete;
    this.dropdown.value = 'red';

    // Red is selected, delete green.
    await deleteProfile(2, 'green');
    assert.deepEqual(this.el.settingsProfiles_, [
      {value: 'default', deletable: false},
      {value: 'red', deletable: true},
    ]);
    assert.equal(this.el.activeSettingsProfile_, 'red');

    // Delete red.
    await deleteProfile(1, 'red');
    assert.deepEqual(this.el.settingsProfiles_, [
      {value: 'default', deletable: false},
    ]);
    assert.equal(this.el.activeSettingsProfile_, 'default');

    // Should not be able to delete default.
    await deleteProfile(0, 'default');
    assert.deepEqual(this.el.settingsProfiles_, [
      {value: 'default', deletable: false},
    ]);
    assert.equal(this.el.activeSettingsProfile_, 'default');
  });
});
