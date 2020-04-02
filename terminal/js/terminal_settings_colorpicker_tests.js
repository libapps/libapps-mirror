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

    const sd = getElement(el, '#swatchdisplay');
    const hi = getElement(el, '#hexinput');
    const slp = getElement(el, 'saturation-lightness-picker');
    const hs = getElement(el, 'hue-slider');
    const ts = getElement(el, 'transparency-slider');

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

  function getElement(el, tagName) {
    const tc = el.shadowRoot.querySelector('terminal-colorpicker');
    return tc.shadowRoot.querySelector(tagName);
  }

  async function allUpdatesComplete(el) {
    if (el.pendingUpdate_) {
      await el.pendingUpdate_;
    }
    await el.updateComplete;
    const tc = el.shadowRoot.querySelector('terminal-colorpicker');
    await tc.updateComplete;
    const slp = getElement(el, 'saturation-lightness-picker');
    const hs = getElement(el, 'hue-slider');
    const ts = getElement(el, 'transparency-slider');
    return Promise.all([slp, hs, ts].map(x => x.updateComplete));
  }

  beforeEach(function() {
    window.preferenceManager =
      new lib.PreferenceManager(new lib.Storage.Memory());
    window.preferenceManager.definePreference(preference, orange);

    this.el = /** @type {!Element} */ (document.createElement(Element.is));
    this.el.setAttribute('preference', preference);
    this.el.updateDelay = 0;
    document.body.appendChild(this.el);

    return allUpdatesComplete(this.el);
  });

  afterEach(function() {
    document.body.removeChild(this.el);

    delete window.preferenceManager;
  });

  it('updates-ui-when-preference-changes', async function() {
    assert.equal(window.preferenceManager.get(preference), orange);
    assertInternals(this.el, '#FFA600', 39, 100, 50, 1);

    await window.preferenceManager.set(preference, 'hsla(12, 34%, 56%, 0.78)');
    await allUpdatesComplete(this.el);
    assertInternals(this.el, '#B57869C7', 12, 34, 56, .78);
  });

  it('updates-preference-when-saturation-lightness-picker-changes',
      async function() {
    assert.equal(window.preferenceManager.get(preference), orange);
    assertInternals(this.el, '#FFA600', 39, 100, 50, 1);

    const slp = getElement(this.el, 'saturation-lightness-picker');
    slp.saturation = 20;
    slp.lightness = 80;
    slp.dispatchEvent(new CustomEvent('updated'));
    await allUpdatesComplete(this.el);

    assertInternals(this.el, '#D6CFC2', 39, 20, 80, 1);
  });

  it('updates-preference-when-hue-slider-changes', async function() {
    assert.equal(window.preferenceManager.get(preference), orange);
    assertInternals(this.el, '#FFA600', 39, 100, 50, 1);

    const hs = getElement(this.el, 'hue-slider');
    hs.hue = 222;
    hs.dispatchEvent(new CustomEvent('updated'));
    await allUpdatesComplete(this.el);

    assertInternals(this.el, '#004CFF', 222, 100, 50, 1);
  });

  it('updates-preference-when-transparency-slider-changes', async function() {
    assert.equal(window.preferenceManager.get(preference), orange);
    assertInternals(this.el, '#FFA600', 39, 100, 50, 1);

    const ts = getElement(this.el, 'transparency-slider');
    ts.transparency = 0.5;
    ts.dispatchEvent(new CustomEvent('updated'));
    await allUpdatesComplete(this.el);

    assertInternals(this.el, '#FFA60080', 39, 100, 50, 0.5);
  });

  it('updates-preference-when-input-element-blurs', async function() {
    assert.equal(window.preferenceManager.get(preference), orange);
    assertInternals(this.el, '#FFA600', 39, 100, 50, 1);

    const hi = getElement(this.el, '#hexinput');
    hi.focus();
    hi.value = 'purple';
    hi.blur();
    await allUpdatesComplete(this.el);

    assert.equal(window.preferenceManager.get(preference), '#A020F0');
    assertInternals(this.el, '#A020F0', 277, 87, 53, 1);
  });

  it('hides-transparency-when-disableTransparency-is-set', async function() {
    assert.isNotNull(getElement(this.el, 'saturation-lightness-picker'));
    assert.isNotNull(getElement(this.el, 'hue-slider'));
    assert.isNotNull(getElement(this.el, 'transparency-slider'));
    this.el.setAttribute('disableTransparency', true);
    await this.el.updateComplete;
    assert.isNotNull(getElement(this.el, 'saturation-lightness-picker'));
    assert.isNotNull(getElement(this.el, 'hue-slider'));
    assert.isNull(getElement(this.el, 'transparency-slider'));
  });

  it('updates-and-closes-dialog-when-enter-pressed-in-input', async function() {
    const dialog = getElement(this.el, 'dialog');
    const swatch = getElement(this.el, '#swatch');
    const hi = getElement(this.el, '#hexinput');

    // Show dialog when swatch clicked.
    assert.isFalse(dialog.hasAttribute('open'));
    swatch.dispatchEvent(new MouseEvent('click'));
    assert.isTrue(dialog.hasAttribute('open'));

    // Modify input and press enter.
    hi.value = 'purple';
    hi.dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter'}));
    await allUpdatesComplete(this.el);

    // Dialog closed and value updated.
    assert.isFalse(dialog.hasAttribute('open'));
    assert.equal(window.preferenceManager.get(preference), '#A020F0');
    assertInternals(this.el, '#A020F0', 277, 87, 53, 1);
  });

  it('closes-dialog-when-ok-clicked', async function() {
    const dialog = getElement(this.el, 'dialog');
    const swatch = getElement(this.el, '#swatch');
    const slp = getElement(this.el, 'saturation-lightness-picker');
    const ok = getElement(this.el, 'terminal-settings-button.action');

    // Show dialog when swatch clicked.
    assert.isFalse(dialog.hasAttribute('open'));
    swatch.dispatchEvent(new MouseEvent('click'));
    assert.isTrue(dialog.hasAttribute('open'));

    // Modify input and click OK.
    slp.saturation = 20;
    slp.lightness = 80;
    slp.dispatchEvent(new CustomEvent('updated'));
    await allUpdatesComplete(this.el);
    ok.dispatchEvent(new MouseEvent('click'));

    // Dialog closed and value updated.
    assert.isFalse(dialog.hasAttribute('open'));
    assert.equal(
        window.preferenceManager.get(preference), 'hsla(39, 20%, 80%, 1)');
    assertInternals(this.el, '#D6CFC2', 39, 20, 80, 1);
  });

  it('closes-dialog-and-reverts-when-cancel-clicked', async function() {
    const dialog = getElement(this.el, 'dialog');
    const swatch = getElement(this.el, '#swatch');
    const slp = getElement(this.el, 'saturation-lightness-picker');
    const cancel = getElement(this.el, 'terminal-settings-button.cancel');

    // Show dialog when swatch clicked.
    assert.isFalse(dialog.hasAttribute('open'));
    swatch.dispatchEvent(new MouseEvent('click'));
    assert.isTrue(dialog.hasAttribute('open'));

    // Modify input and click OK.
    slp.saturation = 20;
    slp.lightness = 80;
    slp.dispatchEvent(new CustomEvent('updated'));
    await allUpdatesComplete(this.el);
    cancel.dispatchEvent(new MouseEvent('click'));
    await allUpdatesComplete(this.el);

    // Dialog closed and value updated.
    assert.isFalse(dialog.hasAttribute('open'));
    assert.equal(window.preferenceManager.get(preference), orange);
    assertInternals(this.el, '#FFA600', 39, 100, 50, 1);
  });
});
