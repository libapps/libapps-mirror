// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Checkbox Polymer Element unit tests.
 */

import {TerminalSettingsCheckboxElement} from './terminal_settings_checkbox.js';

describe('terminal_settings_checkbox_tests.js', () => {
  const preference = 'terminal_settings_checkbox_tests_preference';
  let el;

  before(function() {
    if (customElements.get(TerminalSettingsCheckboxElement.is) === undefined) {
      customElements.define(
          TerminalSettingsCheckboxElement.is,
          TerminalSettingsCheckboxElement);
    }
  });

  beforeEach(function() {
    window.preferenceManager =
      new lib.PreferenceManager(new lib.Storage.Memory());
    window.preferenceManager.definePreference(preference, false);

    el = document.createElement('terminal-settings-checkbox');
    el.setAttribute('description', 'test element');
    el.setAttribute('preference', preference);
    document.body.appendChild(el);
  });

  afterEach(function() {
    document.body.removeChild(el);

    delete window.preferenceManager;
  });

  it('checkbox-updates-when-setting-changes', async function() {
    assert.isFalse(window.preferenceManager.get(preference));
    assert.isFalse(el.shadowRoot.getElementById('checkbox').checked);

    await window.preferenceManager.set(preference, true);
    assert.isTrue(el.shadowRoot.getElementById('checkbox').checked);

    await window.preferenceManager.set(preference, false);
    assert.isFalse(el.shadowRoot.getElementById('checkbox').checked);
  });

  it('setting-updates-when-checkbox-changes', async function() {
    assert.isFalse(window.preferenceManager.get(preference));
    assert.isFalse(el.shadowRoot.getElementById('checkbox').checked);

    el.shadowRoot.getElementById('checkbox').click();
    await lib.waitUntil(() => el.isConsistent());
    assert.isTrue(window.preferenceManager.get(preference));

    el.shadowRoot.getElementById('checkbox').click();
    await lib.waitUntil(() => el.isConsistent());
    assert.isFalse(window.preferenceManager.get(preference));
  });
});
