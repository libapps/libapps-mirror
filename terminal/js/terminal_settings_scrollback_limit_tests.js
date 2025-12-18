// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Unit tests for <terminal-settings-scrollback-limit>
 */

import {lib} from '../../libdot/index.js';
import {hterm} from '../../hterm/index.js';

import {listenForPrefChange} from './terminal_test_util.js';
import {TerminalSettingsScrollbackLimit}
    from './terminal_settings_scrollback_limit.js';

const preference = 'scrollback-limit';

beforeEach(async function() {
  window.preferenceManager =
      new hterm.PreferenceManager(new lib.Storage.Memory());
  window.preferenceManager.definePreference(preference, 10000);

  this.el = /** @type {!TerminalSettingsScrollbackLimit} */ (
      document.createElement('terminal-settings-scrollback-limit'));
  document.body.appendChild(this.el);

  await this.el.updateComplete;
  this.textfield = this.el.shadowRoot.querySelector('terminal-textfield');
  this.setTextfield = (value) => {
    this.textfield.value = value;
    this.textfield.dispatchEvent(new Event('change'));
  };
});

afterEach(function() {
  document.body.removeChild(this.el);

  delete window.preferenceManager;
});

it('updates-ui-when-preference-changes', async function() {
  assert.equal(this.textfield.value, '10000');

  await window.preferenceManager.set(preference, 0);
  assert.equal(this.textfield.value, '0');

  await window.preferenceManager.set(preference, null);
  assert.equal(this.textfield.value, '');
});

it('updates-preference-when-ui-changes', async function() {
  const prefChanged = listenForPrefChange(
      window.preferenceManager, preference);

  this.setTextfield('5000');
  await prefChanged;
  assert.equal(window.preferenceManager.get(preference), 5000);

  this.setTextfield('0');
  await prefChanged;
  assert.equal(window.preferenceManager.get(preference), 0);

  this.setTextfield('-100');
  await prefChanged;
  assert.equal(window.preferenceManager.get(preference), -1);
  assert.equal(this.textfield.value, '', 'input should be clear');

  this.setTextfield('-200');
  await prefChanged;
  assert.equal(window.preferenceManager.get(preference), -1);
  assert.equal(this.textfield.value, '', 'input should be clear');

  this.setTextfield('');
  await prefChanged;
  assert.equal(window.preferenceManager.get(preference), -1);
  assert.equal(this.textfield.value, '');
});
