// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Theme Element unit tests.
 */

import {lib} from '../../libdot/index.js';

import {listenForPrefChange} from './terminal_test.js';
import {TerminalSettingsThemeElement} from './terminal_settings_theme.js';
import {DEFAULT_ANSI_COLORS, DEFAULT_BACKGROUND_COLOR, DEFAULT_CURSOR_COLOR,
    DEFAULT_FOREGROUND_COLOR} from './terminal_common.js';

describe('terminal_settings_theme_tests.js', () => {
  beforeEach(function() {
    window.preferenceManager =
      new lib.PreferenceManager(new lib.Storage.Memory());
    window.preferenceManager.definePreference('theme', 'dark');
    window.preferenceManager.definePreference('theme-variations', {});
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

  function getThemeInner(rootElement, theme) {
    return rootElement.shadowRoot.querySelector(`#${theme} > div.theme-inner`);
  }

  function clickTheme(rootElement, theme) {
    getThemeInner(rootElement, theme).click();
  }

  function enterOnTheme(rootElement, theme) {
    getThemeInner(rootElement, theme).dispatchEvent(
        new KeyboardEvent('keydown', {code: 'Enter'}));
  }

  function spaceOnTheme(rootElement, theme) {
    getThemeInner(rootElement, theme).dispatchEvent(
        new KeyboardEvent('keydown', {code: 'Enter'}));
  }

  const activateThemeFunctions = [
      clickTheme,
      enterOnTheme,
      spaceOnTheme,
  ];

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

  activateThemeFunctions.forEach((activateTheme, index) => {
    it(`updates-preferences-when-ui-changes-${index}`, async function() {
      assert.equal(window.preferenceManager.get('theme'), 'dark');

      const prefChanged = listenForPrefChange(
          window.preferenceManager, 'theme');
      activateTheme(this.el, 'light');
      await prefChanged;
      assert.equal(window.preferenceManager.get('theme'), 'light');
      assert.isFalse(
          this.el.shadowRoot.getElementById('dark').hasAttribute(
              'active-theme'));
      assert.isTrue(this.el.shadowRoot.getElementById('light').hasAttribute(
          'active-theme'));

      // Check hterm settings are changed.
      assert.equal('#FFFFFF',
          window.preferenceManager.get('background-color'));
      assert.equal('#000000',
          window.preferenceManager.get('foreground-color'));
      assert.equal('#1967D280', window.preferenceManager.get('cursor-color'));
      assert.deepEqual(
          ['#E8EAED', '#F28B82', '#108468', '#F29900',
          '#8AB4F8', '#F882FF', '#03BFC8', '#202124',
          '#F8F9FA', '#EE675C', '#108468', '#DB7000',
          '#1A73E8', '#AA00B8', '#009099', '#9AA0A6'],
          window.preferenceManager.get('color-palette-overrides'));
    });
  });

  it('shows-reset-on-variation', async function() {
    assert.equal(window.preferenceManager.get('theme'), 'dark');
    assert.isTrue(
        this.el.shadowRoot.getElementById('dark').hasAttribute('active-theme'));
    assert.isFalse(
        this.el.shadowRoot.getElementById('dark').hasAttribute('reset-theme'));

    await window.preferenceManager.set('background-color', 'purple');
    assert.isTrue(
        this.el.shadowRoot.getElementById('dark').hasAttribute('reset-theme'));
  });

  activateThemeFunctions.forEach((activateTheme, index) => {
    it(`persists-variations-across-selection-${index}`, async function() {
      assert.equal(window.preferenceManager.get('theme'), 'dark');
      assert.isTrue(this.el.shadowRoot.getElementById('dark').hasAttribute(
          'active-theme'));
      await window.preferenceManager.set('background-color', 'purple');
      assert.isTrue(this.el.shadowRoot.getElementById('dark').hasAttribute(
          'reset-theme'));

      let prefChanged = listenForPrefChange(
          window.preferenceManager, 'theme');
      activateTheme(this.el, 'light');
      await prefChanged;
      assert.isTrue(this.el.shadowRoot.getElementById('light').hasAttribute(
          'active-theme'));
      assert.isFalse(this.el.shadowRoot.getElementById('light').hasAttribute(
          'reset-theme'));

      prefChanged = listenForPrefChange(window.preferenceManager, 'theme');
      activateTheme(this.el, 'dark');
      await prefChanged;
      assert.isTrue(this.el.shadowRoot.getElementById('dark').hasAttribute(
          'active-theme'));
      assert.isTrue(this.el.shadowRoot.getElementById('dark').hasAttribute(
          'reset-theme'));
    });
  });

  activateThemeFunctions.forEach((activateTheme, index) => {
    it(`resets-${index}`, async function() {
      const dialog = this.el.shadowRoot.querySelector('terminal-dialog');

      assert.equal(window.preferenceManager.get('theme'), 'dark');
      await window.preferenceManager.set('background-color', 'purple');
      assert.isTrue(this.el.shadowRoot.getElementById('dark').hasAttribute(
          'active-theme'));
      assert.isTrue(this.el.shadowRoot.getElementById('dark').hasAttribute(
          'reset-theme'));
      await window.preferenceManager.set('background-color', 'purple');
      assert.isTrue(this.el.shadowRoot.getElementById('dark').hasAttribute(
          'reset-theme'));

      activateTheme(this.el, 'dark');
      await this.el.updateComplete;
      assert.isTrue(dialog.hasAttribute('open'));

      const prefChanged = listenForPrefChange(
          window.preferenceManager, 'background-color');
      dialog.accept();
      await prefChanged;
      assert.isTrue(this.el.shadowRoot.getElementById('dark').hasAttribute(
          'active-theme'));
      assert.isFalse(this.el.shadowRoot.getElementById('dark').hasAttribute(
          'reset-theme'));
      assert.equal(
          window.preferenceManager.get('background-color'),
          DEFAULT_BACKGROUND_COLOR);
    });
  });
});
