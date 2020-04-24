// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Text Element unit tests.
 */

import {TerminalSettingsTextfieldElement} from
    './terminal_settings_textfield.js';

describe('terminal_settings_textfield_tests.js', () => {
  const preference = 'terminal_settings_textfield_tests_preference';

  beforeEach(function() {
    window.preferenceManager =
      new lib.PreferenceManager(new lib.Storage.Memory());
    window.preferenceManager.definePreference(preference, 'foo');

    const converter = {
      preferenceToDisplay: (preference) => preference.toUpperCase(),
      displayToPreference: (display) => display.toLowerCase(),
    };

    this.el = /** @type {!TerminalSettingsTextfieldElement} */ (
        document.createElement('terminal-settings-textfield'));
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
    assert.equal(window.preferenceManager.get(preference), 'foo');
    assert.equal(this.el.shadowRoot.querySelector('terminal-textfield').value,
        'FOO');

    await window.preferenceManager.set(preference, 'bar');
    assert.equal(this.el.shadowRoot.querySelector('terminal-textfield').value,
        'BAR');
  });

  it('updates-preference-when-ui-changes', async function() {
    const textfield = this.el.shadowRoot.querySelector('terminal-textfield');
    assert.equal(window.preferenceManager.get(preference), 'foo');
    assert.equal(textfield.value, 'FOO');

    const prefChanged = test.listenForPrefChange(
        window.preferenceManager, preference);
    textfield.value = 'BAR';
    textfield.dispatchEvent(new Event('change'));
    await prefChanged;
    assert.equal(window.preferenceManager.get(preference), 'bar');
  });

  it('uses-trivial-converter-by-default', async function() {
    const element = document.createElement('terminal-settings-textfield');
    assert.equal(element.converter.preferenceToDisplay('foo'), 'foo');
    assert.equal(element.converter.displayToPreference('foo'), 'foo');
  });
});
