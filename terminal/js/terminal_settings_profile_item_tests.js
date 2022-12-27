// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from './deps_local.concat.js';

import {ProfileType, getProfileIds, setProfileIds}
  from './terminal_profiles.js';
import {TerminalSettingsProfileItem}
  from './terminal_settings_profile_item.js';

describe('terminal_settings_profile_item.js', function() {
  beforeEach(async function() {
    window.storage = new lib.Storage.Memory();
    await setProfileIds(ProfileType.HTERM, ['default', 'red', 'green']);
    this.el = /** @type {!TerminalSettingsProfileItem} */ (
        document.createElement('terminal-settings-profile-item'));
    this.el.profile = 'red';
    document.body.appendChild(this.el);
    await this.el.updateComplete;
    this.button = this.el.shadowRoot.querySelector('mwc-icon-button');
    this.dialog = this.el.shadowRoot.querySelector('terminal-dialog');
  });

  afterEach(function() {
    document.body.removeChild(this.el);
    delete window.storage;
  });

  it('deletes-profile-and-dispatches-delete-event', async function() {
    const eventFired = new Promise((resolve) => {
      this.el.addEventListener('settings-profile-delete', resolve);
    });
    assert.isFalse(this.dialog.open);
    this.button.click();
    assert.isTrue(this.dialog.open);
    this.dialog.accept();
    await eventFired;
    assert.deepEqual(
        ['default', 'green'], await getProfileIds(ProfileType.HTERM));
  });
});
