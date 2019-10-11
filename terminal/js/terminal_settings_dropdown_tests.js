// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Dropdown Element unit tests.
 */

import {TerminalSettingsDropdownElement} from './terminal_settings_dropdown.js';

describe('terminal_settings_dropdown_tests.js', () => {
  const preference = 'terminal_settings_dropdown_tests_preference';
  const options = ['opt1', 'opt2', 'opt3'];

  before(function() {
    if (customElements.get(TerminalSettingsDropdownElement.is) === undefined) {
      customElements.define(
          TerminalSettingsDropdownElement.is,
          TerminalSettingsDropdownElement);
    }
  });

  beforeEach(function() {
    window.PreferenceManager = {
      defaultPreferences: {
        [preference]: {type: options},
      }
    };
    window.preferenceManager =
      new lib.PreferenceManager(new lib.Storage.Memory());
    window.preferenceManager.definePreference(preference, options[0]);

    this.el = /** @type {!TerminalSettingsDropdownElement} */ (
        document.createElement('terminal-settings-dropdown'));
    this.el.setAttribute('preference', preference);
    document.body.appendChild(this.el);

    // The element renders asynchronously.
    return this.el.updateComplete;
  });

  afterEach(function() {
    document.body.removeChild(this.el);

    delete window.preferenceManager;
    delete window.PreferenceManager;
  });

  it('updates-ui-when-preference-changes', async function() {
    assert.equal(window.preferenceManager.get(preference), options[0]);
    assert.equal(this.el.shadowRoot.getElementById('select').value, options[0]);

    await window.preferenceManager.set(preference, options[1]);
    assert.equal(this.el.shadowRoot.getElementById('select').value, options[1]);

    await window.preferenceManager.set(preference, options[2]);
    assert.equal(this.el.shadowRoot.getElementById('select').value, options[2]);
  });

  it('updates-preference-when-ui-changes', async function() {
    const selectEl = this.el.shadowRoot.getElementById('select');
    assert.equal(window.preferenceManager.get(preference), options[0]);
    assert.equal(selectEl.value, options[0]);

    let prefChanged = test.listenForPrefChange(
        window.preferenceManager, preference);
    selectEl.selectedIndex = 1;
    selectEl.dispatchEvent(new Event('change'));
    await prefChanged;
    assert.equal(window.preferenceManager.get(preference), options[1]);

    prefChanged = test.listenForPrefChange(
        window.preferenceManager, preference);
    selectEl.selectedIndex = 2;
    selectEl.dispatchEvent(new Event('change'));
    await prefChanged;
    assert.equal(window.preferenceManager.get(preference), options[2]);
  });
});
