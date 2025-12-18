// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../../libdot/index.js';

import {ProfileType, getProfileIds, setProfileIds}
  from './terminal_profiles.js';
import {TerminalSettingsProfileHeader}
  from './terminal_settings_profile_header.js';

beforeEach(async function() {
  window.storage = new lib.Storage.Memory();
  await setProfileIds(ProfileType.HTERM, ['default']);
  this.el = /** @type {!TerminalSettingsProfileHeader} */ (
      document.createElement('terminal-settings-profile-header'));
  document.body.appendChild(this.el);
  await this.el.updateComplete;
  this.button = this.el.shadowRoot.querySelector('mwc-icon-button');
  this.dialog = this.el.shadowRoot.querySelector('terminal-dialog');
});

afterEach(function() {
  document.body.removeChild(this.el);
  delete window.storage;
});

it('adds-new-profiles-and-dispatches-add-event', async function() {
  const eventFired = new Promise((resolve) => {
    this.el.addEventListener('settings-profile-add', resolve);
  });
  assert.isFalse(this.dialog.open);
  this.button.click();
  assert.isTrue(this.dialog.open);
  this.el.shadowRoot.querySelector('terminal-textfield').value = 'red';
  this.dialog.accept();
  await eventFired;
  assert.deepEqual(
      ['default', 'red'], await getProfileIds(ProfileType.HTERM));
});
