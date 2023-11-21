// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings ANSI Colors Element unit tests.
 */

import {lib} from '../../libdot/index.js';
import {hterm} from '../../hterm/index.js';

import {TerminalSettingsAnsiColorsElement as Element} from
    './terminal_settings_ansi_colors.js';
import {DEFAULT_ANSI_COLORS} from './terminal_common.js';

describe('terminal_settings_ansi_colors.js', () => {
  const preference = 'terminal_settings_ansi_colors';
  const orange = 'hsl(39, 100%, 50%)';

  beforeEach(function() {
    window.preferenceManager =
        new hterm.PreferenceManager(new lib.Storage.Memory());
    window.preferenceManager.definePreference(preference, null);

    this.el = /** @type {!Element} */ (document.createElement(Element.is));
    this.el.setAttribute('preference', preference);
    document.body.appendChild(this.el);

    return this.el.updateComplete;
  });

  afterEach(function() {
    document.body.removeChild(this.el);
    delete window.preferenceManager;
  });

  it('uses-defaults-when-preference-is-null', function() {
    assert.equal(window.preferenceManager.get(preference), null);
    assert.deepEqual(DEFAULT_ANSI_COLORS, this.el.value);
  });

  it('updates-ui-when-preference-changes', async function() {
    const prefs = DEFAULT_ANSI_COLORS.slice();
    prefs[4] = orange;
    await window.preferenceManager.set(preference, prefs);
    assert.deepEqual(prefs, this.el.value);
    const cp0 = this.el.shadowRoot.querySelectorAll('terminal-colorpicker')[0];
    const cp4 = this.el.shadowRoot.querySelectorAll('terminal-colorpicker')[4];
    assert.equal(DEFAULT_ANSI_COLORS[0], cp0.value);
    assert.equal(orange, cp4.value);
  });

  it('updates-preference-when-ui-changes', async function() {
    const prefs = DEFAULT_ANSI_COLORS.slice();
    prefs[4] = orange;
    assert.equal(window.preferenceManager.get(preference), null);
    const cp4 = this.el.shadowRoot.querySelectorAll('terminal-colorpicker')[4];
    cp4.onUiChanged_(orange);
    assert.deepEqual(prefs, this.el.value);
    assert.deepEqual(window.preferenceManager.get(preference), prefs);
  });
});
