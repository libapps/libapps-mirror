// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Theme Element unit tests.
 */

import {TerminalSettingsThemeElement} from './terminal_settings_theme.js';
import {DEFAULT_ANSI_COLORS, DEFAULT_BACKGROUND_COLOR, DEFAULT_CURSOR_COLOR,
    DEFAULT_FOREGROUND_COLOR} from './terminal_common.js';

describe('terminal_settings_theme_tests.js', () => {
  beforeEach(function() {
    window.preferenceManager =
      new lib.PreferenceManager(new lib.Storage.Memory());
    window.preferenceManager.definePreference('theme', 'dark');
    window.preferenceManager.definePreference(
        'background-color', DEFAULT_BACKGROUND_COLOR);
    window.preferenceManager.definePreference(
        'foreground-color', DEFAULT_FOREGROUND_COLOR);
    window.preferenceManager.definePreference(
        'cursor-color', DEFAULT_CURSOR_COLOR);
    window.preferenceManager.definePreference(
        'color-palette-overrides', DEFAULT_ANSI_COLORS);

    this.el = /** @type {!TerminalSettingsThemeElement} */ (
        document.createElement('terminal-settings-theme'));
    document.body.appendChild(this.el);

    // The element renders asynchronously.
    return this.el.updateComplete;
  });

  afterEach(function() {
    document.body.removeChild(this.el);

    delete window.preferenceManager;
  });

  it('updates-ui-when-preference-changes', async function() {
    assert.equal(window.preferenceManager.get('theme'), 'dark');
    assert.isTrue(
        this.el.shadowRoot.getElementById('dark').hasAttribute('active-theme'));
    assert.isFalse(this.el.shadowRoot.getElementById('light').hasAttribute(
        'active-theme'));
    assert.equal(
        DEFAULT_BACKGROUND_COLOR,
        window.preferenceManager.get('background-color'));

    await window.preferenceManager.set('theme', 'light');
    assert.isFalse(
        this.el.shadowRoot.getElementById('dark').hasAttribute('active-theme'));
    assert.isTrue(this.el.shadowRoot.getElementById('light').hasAttribute(
        'active-theme'));

    // Check hterm settings are not changed.
    assert.equal(
        DEFAULT_BACKGROUND_COLOR,
        window.preferenceManager.get('background-color'));
    assert.equal(
        DEFAULT_FOREGROUND_COLOR,
        window.preferenceManager.get('foreground-color'));
    assert.equal(
        DEFAULT_CURSOR_COLOR, window.preferenceManager.get('cursor-color'));
    assert.deepEqual(
        DEFAULT_ANSI_COLORS,
        window.preferenceManager.get('color-palette-overrides'));
  });

  it('updates-preferences-when-ui-changes', async function() {
    assert.equal(window.preferenceManager.get('theme'), 'dark');

    let prefChanged = test.listenForPrefChange(
        window.preferenceManager, 'theme');
    this.el.shadowRoot.getElementById('light').click();
    await prefChanged;
    assert.equal(window.preferenceManager.get('theme'), 'light');
    assert.isFalse(
        this.el.shadowRoot.getElementById('dark').hasAttribute('active-theme'));
    assert.isTrue(this.el.shadowRoot.getElementById('light').hasAttribute(
        'active-theme'));

    // Check hterm settings are changed.
    assert.equal('#FFFFFF', window.preferenceManager.get('background-color'));
    assert.equal('#000000', window.preferenceManager.get('foreground-color'));
    assert.equal(
        'rgba(66, 133, 243, 0.5)',
        window.preferenceManager.get('cursor-color'));
    assert.deepEqual(
        ['#425B74', '#B42D25', '#1967D2', '#935236',
         '#6355BA', '#A51BB5', '#53671E', '#363A3D',
         '#4B6A88', '#D93025', '#1A73E8', '#B05E3B',
         '#7462E0', '#C61AD9', '#60781D', '#3C4043'],
        window.preferenceManager.get('color-palette-overrides'));
  });
});
