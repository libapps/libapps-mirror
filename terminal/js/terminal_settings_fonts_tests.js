// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Fonts Element unit tests.
 */

import {lib} from '../../libdot/index.js';
import {hterm} from '../../hterm/index.js';

import {SUPPORTED_FONT_FAMILIES, DEFAULT_FONT_FAMILY}
    from './terminal_common.js';
import './terminal_settings_fonts.js';

describe('terminal_settings_fonts_tests.js', () => {
  beforeEach(async function() {
    window.preferenceManager =
        new hterm.PreferenceManager(new lib.Storage.Memory());
    window.preferenceManager.definePreference(
      'font-family', DEFAULT_FONT_FAMILY);

    this.fontInfo = new Map();
    for (const font of SUPPORTED_FONT_FAMILIES) {
      let resolve, reject;
      const promise = new Promise((resolve2, reject2) => {
        resolve = resolve2;
        reject = reject2;
      });
      this.fontInfo.set(font, {
        promise,
        resolve,
        reject,
      });
    }

    this.el = document.createElement('terminal-settings-fonts');
    this.el.fontManager_ = {
      loadFont: (font) => this.fontInfo.get(font).promise,
    };
    document.body.appendChild(this.el);
    await this.el.updateComplete;
    this.dropdown = this.el.shadowRoot.querySelector(
        'terminal-settings-dropdown');
  });

  afterEach(function() {
    document.body.removeChild(this.el);

    delete window.preferenceManager;
  });

  it('enable-loaded-web-fonts', async function() {
    assert.equal(this.dropdown.options.length, SUPPORTED_FONT_FAMILIES.length);

    // We need double layers of async (instead of directly await on
    // |this.el.updateComplete|) so that the font promise handlers in
    // TerminalSettingsFonts are first triggered to schedule an update.
    // Otherwise, there is nothing to update so |await this.el.updateComplete|
    // returns without triggering a re-rendering.
    const waitUpdate = async () => this.el.updateComplete;

    // All fonts should be disabled by default.
    for (const {disabled} of this.dropdown.options) {
      assert.isTrue(disabled);
    }

    // "Load" first font
    const fonts = Array.from(this.fontInfo.keys());
    this.fontInfo.get(fonts[0]).resolve();
    await waitUpdate();
    this.dropdown.options.forEach(({label, disabled}) => {
      assert.equal(
          disabled,
          label !== fonts[0],
          `"${label}"->${disabled}`);
    });

    // Reject the second font and "load" the rest.
    this.fontInfo.get(fonts[1]).reject();
    for (const font of fonts.slice(2)) {
      this.fontInfo.get(font).resolve();
    }
    await waitUpdate();
    this.dropdown.options.forEach(({label, disabled}) => {
      assert.equal(disabled, label === fonts[1]);
    });
  });
});
