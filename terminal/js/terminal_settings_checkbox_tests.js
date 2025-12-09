// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Checkbox Element unit tests.
 */

import {lib} from '../../libdot/index.js';
import {hterm} from '../../hterm/index.js';

import {listenForPrefChange} from './terminal_test_util.js';
import {TerminalSettingsCheckboxElement} from './terminal_settings_checkbox.js';

describe('terminal_settings_checkbox_tests.js', () => {
  const preference = 'terminal_settings_checkbox_tests_preference';

  beforeEach(function() {
    window.preferenceManager =
        new hterm.PreferenceManager(new lib.Storage.Memory());
    window.preferenceManager.definePreference(preference, 'off');

    const converter = {
      toChecked: (value) => value === 'on',
      fromChecked: (checked) => checked ? 'on' : 'off',
    };

    this.el = /** @type {!TerminalSettingsCheckboxElement} */ (
        document.createElement('terminal-settings-checkbox'));
    this.el.setAttribute('preference', preference);
    this.el.converter = converter;
    document.body.appendChild(this.el);

    // The element renders asynchronously.
    return this.el.updateComplete;
  });

  afterEach(function() {
    document.body.removeChild(this.el);

    delete window.preferenceManager;
  });

  it('updates-ui-when-preference-changes', async function() {
    assert.equal(window.preferenceManager.get(preference), 'off');
    assert.isFalse(this.el.shadowRoot.getElementById('checkbox').checked);

    await window.preferenceManager.set(preference, 'on');
    assert.isTrue(this.el.shadowRoot.getElementById('checkbox').checked);

    await window.preferenceManager.set(preference, 'off');
    assert.isFalse(this.el.shadowRoot.getElementById('checkbox').checked);
  });

  it('updates-preference-when-ui-changes', async function() {
    assert.equal(window.preferenceManager.get(preference), 'off');
    assert.isFalse(this.el.shadowRoot.getElementById('checkbox').checked);

    let prefChanged = listenForPrefChange(
        window.preferenceManager, preference);
    this.el.shadowRoot.getElementById('checkbox').click();
    await prefChanged;
    assert.equal(window.preferenceManager.get(preference), 'on');

    prefChanged = listenForPrefChange(
        window.preferenceManager, preference);
    this.el.shadowRoot.getElementById('checkbox').click();
    await prefChanged;
    assert.equal(window.preferenceManager.get(preference), 'off');
  });

  it('uses-trivial-converter-by-default', async function() {
    const element = document.createElement('terminal-settings-checkbox');

    assert.isTrue(element.converter.toChecked(true));
    assert.isFalse(element.converter.toChecked(false));
    assert.isTrue(element.converter.fromChecked(true));
    assert.isFalse(element.converter.fromChecked(false));
  });
});
