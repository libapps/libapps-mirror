// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Colorpicker Element unit tests.
 */

import {TerminalSettingsColorpickerElement as Element} from
    './terminal_settings_colorpicker.js';

const orange = 'hsl(39, 100%, 50%)';

describe('terminal_settings_colorpicker.js', () => {
  const preference = 'terminal_settings_colorpicker';

  function assertInternals(el, hex, hue, saturation, lightness, transparency) {
    const crackedHSL = lib.colors.crackHSL(
        lib.notNull(lib.colors.normalizeCSSToHSL(el.value)));
    assert.equal(+crackedHSL[0], hue);
    assert.equal(+crackedHSL[1], saturation);
    assert.equal(+crackedHSL[2], lightness);
    assert.equal(+crackedHSL[3], transparency);

    const sd = el.shadowRoot.getElementById('swatchdisplay');
    const hi = el.shadowRoot.getElementById('hexinput');
    const slp = el.shadowRoot.querySelector('saturation-lightness-picker');
    const hs = el.shadowRoot.querySelector('hue-slider');
    const ts = el.shadowRoot.querySelector('transparency-slider');

    // Compare against attribute value, not style value, as style value yeilds a
    // converted color in rgba form.
    assert.equal(sd.getAttribute('style'), `background-color: ${el.value}`);
    assert.equal(hi.value, hex);
    const error = 0.005;
    assert.closeTo(+slp.getAttribute('hue'), hue, error);
    assert.closeTo(+slp.getAttribute('saturation'), saturation, error);
    assert.closeTo(+slp.getAttribute('lightness'), lightness, error);
    assert.closeTo(+hs.getAttribute('hue'), hue, error);
    assert.closeTo(+ts.getAttribute('hue'), hue, error);
    assert.closeTo(+ts.getAttribute('transparency'), transparency, error);
  }

  function allUpdatesComplete(el) {
    return new Promise((resolve, reject) => {
      el.updateComplete.then(() => {
        const slp =
            el.shadowRoot.querySelector('saturation-lightness-picker');
        const hs = el.shadowRoot.querySelector('hue-slider');
        const ts = el.shadowRoot.querySelector('transparency-slider');

        Promise.all([slp, hs, ts].map(x => x.updateComplete)).then(resolve);
      });
    });
  }

  beforeEach(function() {
    window.preferenceManager =
      new lib.PreferenceManager(new lib.Storage.Memory());
    window.preferenceManager.definePreference(preference, orange);

    this.el = /** @type {!Element} */ (document.createElement(Element.is));
    this.el.setAttribute('preference', preference);
    document.body.appendChild(this.el);

    return allUpdatesComplete(this.el);
  });

  afterEach(function() {
    document.body.removeChild(this.el);

    delete window.preferenceManager;
  });

  it('shows-and-hides-dialog', function() {
    const dialog = this.el.shadowRoot.querySelector('dialog');
    const swatch = this.el.shadowRoot.querySelector('#swatch');
    const slp = this.el.shadowRoot.querySelector('saturation-lightness-picker');

    // Show dialog when swatch clicked.
    assert.isFalse(dialog.hasAttribute('open'));
    swatch.dispatchEvent(new MouseEvent('click'));
    assert.isTrue(dialog.hasAttribute('open'));

    // Close dialog when backdrop clicked, but not elements in dialog.
    slp.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    assert.isTrue(dialog.hasAttribute('open'));
    dialog.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    assert.isFalse(dialog.hasAttribute('open'));
  });

  it('updates-ui-when-preference-changes', async function() {
    assert.equal(window.preferenceManager.get(preference), orange);
    assertInternals(this.el, '#ffa600', 39, 100, 50, 1);

    await window.preferenceManager.set(preference, 'hsla(12, 34%, 56%, 0.78)');
    assertInternals(this.el, '#b57869c7', 12, 34, 56, .78);
  });

  it('updates-preference-when-saturation-lightness-picker-changes',
      async function() {
    assert.equal(window.preferenceManager.get(preference), orange);
    assertInternals(this.el, '#ffa600', 39, 100, 50, 1);

    const slp = this.el.shadowRoot.querySelector('saturation-lightness-picker');
    slp.saturation = 20;
    slp.lightness = 80;
    slp.dispatchEvent(new CustomEvent('updated'));
    await allUpdatesComplete(this.el);

    assertInternals(this.el, '#d6cfc2', 39, 20, 80, 1);
  });

  it('updates-preference-when-hue-slider-changes', async function() {
    assert.equal(window.preferenceManager.get(preference), orange);
    assertInternals(this.el, '#ffa600', 39, 100, 50, 1);

    const hs = this.el.shadowRoot.querySelector('hue-slider');
    hs.hue = 222;
    hs.dispatchEvent(new CustomEvent('updated'));
    await allUpdatesComplete(this.el);

    assertInternals(this.el, '#004cff', 222, 100, 50, 1);
  });

  it('updates-preference-when-transparency-slider-changes', async function() {
    assert.equal(window.preferenceManager.get(preference), orange);
    assertInternals(this.el, '#ffa600', 39, 100, 50, 1);

    const ts = this.el.shadowRoot.querySelector('transparency-slider');
    ts.transparency = 0.5;
    ts.dispatchEvent(new CustomEvent('updated'));
    await allUpdatesComplete(this.el);

    assertInternals(this.el, '#ffa60080', 39, 100, 50, 0.5);
  });

  it('updates-preference-when-input-element-blurs', async function() {
    assert.equal(window.preferenceManager.get(preference), orange);
    assertInternals(this.el, '#ffa600', 39, 100, 50, 1);

    const hi = this.el.shadowRoot.getElementById('hexinput');
    hi.focus();
    hi.value = 'purple';
    hi.blur();
    await allUpdatesComplete(this.el);

    assert.equal(window.preferenceManager.get(preference), 'rgb(160, 32, 240)');
    assertInternals(this.el, '#a020f0', 277, 87, 53, 1);
  });

  it('hides-transparency-when-disableTransparency-is-set', async function() {
    assert.isNotNull(
        this.el.shadowRoot.querySelector('saturation-lightness-picker'));
    assert.isNotNull(this.el.shadowRoot.querySelector('hue-slider'));
    assert.isNotNull(this.el.shadowRoot.querySelector('transparency-slider'));
    this.el.setAttribute('disableTransparency', true);
    await this.el.updateComplete;
    assert.isNotNull(
        this.el.shadowRoot.querySelector('saturation-lightness-picker'));
    assert.isNotNull(this.el.shadowRoot.querySelector('hue-slider'));
    assert.isNull(this.el.shadowRoot.querySelector('transparency-slider'));
  });
});
