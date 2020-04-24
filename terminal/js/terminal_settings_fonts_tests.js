// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Fonts Element unit tests.
 */

import {SUPPORTED_FONT_FAMILIES, DEFAULT_FONT_FAMILY}
    from './terminal_common.js';
import './terminal_settings_fonts.js';

describe('terminal_settings_fonts_tests.js', () => {
  beforeEach(async function() {
    window.preferenceManager =
      new lib.PreferenceManager(new lib.Storage.Memory());
    window.preferenceManager.definePreference('font-family',
        DEFAULT_FONT_FAMILY);

    this.loadWebFontsMock = [];
    window.webFontPromises = new Map();
    for (const [font, isWebFont] of SUPPORTED_FONT_FAMILIES) {
      if (isWebFont) {
        window.webFontPromises.set(font, new Promise((resolve, reject) => {
          this.loadWebFontsMock.push({font, resolve, reject});
        }));
      }
    }

    this.el = document.createElement('terminal-settings-fonts');
    document.body.appendChild(this.el);
    await this.el.updateComplete;
    this.dropdown = this.el.shadowRoot.querySelector(
        'terminal-settings-dropdown');
  });

  afterEach(function() {
    document.body.removeChild(this.el);

    delete window.webFontPromises;
    delete window.preferenceManager;
  });

  it('enable-loaded-web-fonts', async function() {
    assert.equal(this.dropdown.options.length, SUPPORTED_FONT_FAMILIES.size);

    // We need double layers of async (instead of directly await on
    // |this.el.updateComplete|) so that the font promise handlers in
    // TerminalSettingsFonts are first triggered to schedule an update.
    // Otherwise, there is nothing to update so |await this.el.updateComplete|
    // returns without triggering a re-rendering.
    const waitUpdate = async () => this.el.updateComplete;

    // All web fonts should be disabled by default.
    this.dropdown.options.forEach(({label, disabled}) => {
      assert.equal(
          disabled,
          window.webFontPromises.has(label),
          `"${label}"->${disabled}`);
    });

    // "Load" first web font
    this.loadWebFontsMock[0].resolve(true);
    await waitUpdate();
    this.dropdown.options.forEach(({label, disabled}) => {
      assert.equal(
          disabled,
          window.webFontPromises.has(label) &&
              label !== this.loadWebFontsMock[0].font,
          `"${label}"->${disabled}`);
    });

    // Reject the the second web font and "load" the rest.
    this.loadWebFontsMock[1].reject();
    this.loadWebFontsMock.slice(2).forEach(({resolve}) => resolve(true));
    await waitUpdate();
    this.dropdown.options.forEach(({label, disabled}) => {
      assert.equal(disabled, label === this.loadWebFontsMock[1].font);
    });
  });
});
