// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Colorpicker Element unit tests.
 */

import {TerminalSettingsColorpickerElement as Element} from
    './terminal_settings_colorpicker.js';

describe('terminal_settings_colorpicker.js', () => {
  const preference = 'terminal_settings_colorpicker';

  function assertInternals(el, hex, hue, saturation, lightness, transparency) {
    assert.equal(el.value, hex);

    const sd = el.shadowRoot.getElementById('swatchdisplay');
    const hi = el.shadowRoot.getElementById('hexinput');
    const slp = el.shadowRoot.querySelector('saturation-lightness-picker');
    const hs = el.shadowRoot.querySelector('hue-slider');
    const ts = el.shadowRoot.querySelector('transparency-slider');

    // Compare against attribute value, not style value, as style value yeilds a
    // converted color in rgba form.
    assert.equal(sd.getAttribute('style'), `background-color: ${hex}`);
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
    window.preferenceManager.definePreference(preference, 'orange');

    this.el = /** @type {!Element} */ (document.createElement(Element.is));
    this.el.setAttribute('preference', preference);
    document.body.appendChild(this.el);

    return allUpdatesComplete(this.el);
  });

  afterEach(function() {
    document.body.removeChild(this.el);

    delete window.preferenceManager;
  });

  it('updates-ui-when-preference-changes', async function() {
    assert.equal(window.preferenceManager.get(preference), 'orange');
    assertInternals(this.el, '#ffa500', 38.82, 100, 50, 1);

    await window.preferenceManager.set(preference, 'rgba(181, 120, 105, 0.78)');
    assertInternals(this.el, '#b57869c7', 11.84, 33.93, 56.08, .78);
  });

  it('updates-preference-when-saturation-lightness-picker-changes',
      async function() {
    assert.equal(window.preferenceManager.get(preference), 'orange');
    assertInternals(this.el, '#ffa500', 38.82, 100, 50, 1);

    const slp = this.el.shadowRoot.querySelector('saturation-lightness-picker');
    slp.saturation = 20;
    slp.lightness = 80;
    slp.dispatchEvent(new CustomEvent('updated'));
    await allUpdatesComplete(this.el);

    assertInternals(this.el, '#d6cfc2', 38.82, 20, 80, 1);
  });

  it('updates-preference-when-hue-slider-changes', async function() {
    assert.equal(window.preferenceManager.get(preference), 'orange');
    assertInternals(this.el, '#ffa500', 38.82, 100, 50, 1);

    const hs = this.el.shadowRoot.querySelector('hue-slider');
    hs.hue = 222;
    hs.dispatchEvent(new CustomEvent('updated'));
    await allUpdatesComplete(this.el);

    assertInternals(this.el, '#004cff', 222, 100, 50, 1);
  });

  it('updates-preference-when-transparency-slider-changes', async function() {
    assert.equal(window.preferenceManager.get(preference), 'orange');
    assertInternals(this.el, '#ffa500', 38.82, 100, 50, 1);

    const ts = this.el.shadowRoot.querySelector('transparency-slider');
    ts.transparency = 0.5;
    ts.dispatchEvent(new CustomEvent('updated'));
    await allUpdatesComplete(this.el);

    assertInternals(this.el, '#ffa60080', 38.82, 100, 50, 0x80 / 0xff);
  });

  it('updates-preference-when-input-element-blurs', async function() {
    assert.equal(window.preferenceManager.get(preference), 'orange');
    assertInternals(this.el, '#ffa500', 38.82, 100, 50, 1);

    const hi = this.el.shadowRoot.getElementById('hexinput');
    hi.focus();
    hi.value = 'purple';
    hi.blur();
    await allUpdatesComplete(this.el);

    assert.equal(window.preferenceManager.get(preference), 'rgb(160, 32, 240)');
    assertInternals(this.el, '#a020f0', 276.92, 87.39, 53.33, 1);
  });

  // TODO(lxj@google.com)
  it('BUG-sometimes-updates-hue-when-saturation-lightness-changes',
     async function() {
    const hs = this.el.shadowRoot.querySelector('hue-slider');
    const slp = this.el.shadowRoot.querySelector('saturation-lightness-picker');

    await window.preferenceManager.set(preference, '#d2adeb');
    assert.closeTo(+hs.getAttribute('hue'), 275.8, 0.05);

    // Changes to any of the hue/saturation/lightness shouldn't affect the other
    // values. However direct changes that are small to any of these values
    // should be reflected in the ui.
    slp.saturation = 15;
    slp.lightness = 53;
    slp.dispatchEvent(new CustomEvent('updated'));
    await allUpdatesComplete(this.el);
    assert.closeTo(+hs.getAttribute('hue'), 276.7, 0.05);
  });
});
