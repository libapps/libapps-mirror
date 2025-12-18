// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Colorpicker Element unit tests.
 */

import {lib} from '../../libdot/index.js';
import {hterm} from '../../hterm/index.js';

import {TerminalSettingsColorpickerElement, TOO_WHITE_BOX_SHADOW,
  FOCUS_BOX_SHADOW} from './terminal_settings_colorpicker.js';

const preference = 'terminal_settings_colorpicker';

/**
 * @param {!Array<number>} hsvx
 * @return {string}}
 */
function hsvxToCSS(hsvx) {
  return lib.colors.arrayToHSLA(lib.colors.hsvxArrayToHslaArray(hsvx));
}

const orange = hsvxToCSS([39, 100, 100]);

/**
 * Extract css setting from the style attribute of an element.
 *
 * Unlike element.style.name, which normalizes the value, this function
 * preserves the original value.
 *
 * @param {!HTMLElement} element
 * @param {string} name
 * @return {string}
 */
function extractInlineStyle(element, name) {
  const re = new RegExp(`${name}:([^;]*)`);
  return element.getAttribute('style').match(re)[1].trim();
}

/**
 * @param {!HTMLElement} el
 * @param {string} hex
 * @param {number} hue
 * @param {number} saturation
 * @param {number} value
 * @param {number} transparency
 */
function assertInternals(el, hex, hue, saturation, value, transparency) {
  assert.equal(lib.colors.rgbToHex(
      lib.notNull(lib.colors.normalizeCSS(el.value))).toUpperCase(), hex);

  const sd = getElement(el, '#swatchdisplay');
  const hi = getElement(el, '#hexinput');
  const svp = getElement(el, 'saturation-value-picker');
  const hs = getElement(el, 'hue-slider');
  const ts = getElement(el, 'transparency-slider');

  assert.equal(extractInlineStyle(sd, 'background-color'), el.value);
  assert.equal(hi.value, hex);
  const error = 1;
  assert.closeTo(+svp.getAttribute('hue'), hue, error);
  assert.closeTo(+svp.getAttribute('saturation'), saturation, error);
  assert.closeTo(+svp.getAttribute('value'), value, error);
  assert.closeTo(+hs.getAttribute('hue'), hue, error);
  assert.equal(ts.getAttribute('color'), el.value);
  assert.closeTo(+ts.getAttribute('transparency'), transparency, error);
}

/**
 * @param {!Element} el
 * @param {string} tagName
 * @return {!HTMLElement}
 */
function getElement(el, tagName) {
  const tc = el.shadowRoot.querySelector('terminal-colorpicker');
  return tc.shadowRoot.querySelector(tagName);
}

/**
 * @param {!Element} el
 * @return {!Promise<!Array<void>>}
 */
async function allUpdatesComplete(el) {
  if (el.pendingUpdate_) {
    await el.pendingUpdate_;
  }
  await el.updateComplete;
  const tc = el.shadowRoot.querySelector('terminal-colorpicker');
  await tc.updateComplete;
  const svp = getElement(el, 'saturation-value-picker');
  const hs = getElement(el, 'hue-slider');
  const ts = getElement(el, 'transparency-slider');
  return Promise.all([svp, hs, ts].map((x) => x.updateComplete));
}

beforeEach(function() {
  window.preferenceManager =
      new hterm.PreferenceManager(new lib.Storage.Memory());
  window.preferenceManager.definePreference(preference, orange);

  this.el = /** @type {!TerminalSettingsColorpickerElement} */ (
      document.createElement(TerminalSettingsColorpickerElement.is));
  this.el.setAttribute('preference', preference);
  this.el.updateDelay = 0;
  document.body.appendChild(this.el);

  this.waitDialogClose = () => new Promise((resolve) => {
    getElement(this.el, 'terminal-dialog').addEventListener(
        'close', resolve, {once: true});
  });

  return allUpdatesComplete(this.el);
});

afterEach(function() {
  document.body.removeChild(this.el);

  delete window.preferenceManager;
});

it('updates-ui-when-preference-changes', async function() {
  assert.equal(window.preferenceManager.get(preference), orange);
  assertInternals(this.el, '#FFA600', 39, 100, 100, 1);

  await window.preferenceManager.set(preference,
      hsvxToCSS([12, 34, 56, .78]));
  await allUpdatesComplete(this.el);
  assertInternals(this.el, '#8D675EC7', 12, 34, 56, .78);
});

it('updates-preference-when-saturation-value-picker-changes',
    async function() {
  assert.equal(window.preferenceManager.get(preference), orange);
  assertInternals(this.el, '#FFA600', 39, 100, 100, 1);

  const svp = getElement(this.el, 'saturation-value-picker');
  svp.saturation = 20;
  svp.value = 80;
  svp.dispatchEvent(new CustomEvent('change'));
  await allUpdatesComplete(this.el);

  assertInternals(this.el, '#CCBEA3', 39, 20, 80, 1);
});

it('updates-preference-when-hue-slider-changes', async function() {
  assert.equal(window.preferenceManager.get(preference), orange);
  assertInternals(this.el, '#FFA600', 39, 100, 100, 1);

  const hs = getElement(this.el, 'hue-slider');
  hs.hue = 222;
  hs.dispatchEvent(new CustomEvent('change'));
  await allUpdatesComplete(this.el);

  assertInternals(this.el, '#004CFF', 222, 100, 100, 1);
});

it('updates-preference-when-transparency-slider-changes', async function() {
  assert.equal(window.preferenceManager.get(preference), orange);
  assertInternals(this.el, '#FFA600', 39, 100, 100, 1);

  const ts = getElement(this.el, 'transparency-slider');
  ts.transparency = 0.5;
  ts.dispatchEvent(new CustomEvent('change'));
  await allUpdatesComplete(this.el);

  assertInternals(this.el, '#FFA60080', 39, 100, 100, 0.5);
});

it('updates-preference-when-input-element-changes', async function() {
  assert.equal(window.preferenceManager.get(preference), orange);
  assertInternals(this.el, '#FFA600', 39, 100, 100, 1);

  const hi = getElement(this.el, '#hexinput');
  hi.value = 'purple';
  hi.dispatchEvent(new Event('change'));
  await allUpdatesComplete(this.el);

  assert.equal(window.preferenceManager.get(preference), '#A020F0');
  assertInternals(this.el, '#A020F0', 277, 87, 94, 1);
});

it('hides-transparency-when-disableTransparency-is-set', async function() {
  assert.isNotNull(getElement(this.el, 'saturation-value-picker'));
  assert.isNotNull(getElement(this.el, 'hue-slider'));
  assert.isNotNull(getElement(this.el, 'transparency-slider'));
  this.el.setAttribute('disableTransparency', true);
  await this.el.updateComplete;
  assert.isNotNull(getElement(this.el, 'saturation-value-picker'));
  assert.isNotNull(getElement(this.el, 'hue-slider'));
  assert.isNull(getElement(this.el, 'transparency-slider'));
});

it('open-dialog-on-swatch-clicked', async function() {
  const swatch = getElement(this.el, '#swatch');
  const dialog = getElement(this.el, 'terminal-dialog');

  assert.isFalse(dialog.hasAttribute('open'));

  swatch.dispatchEvent(new MouseEvent('click'));
  await this.el.updateComplete;
  assert.isTrue(dialog.hasAttribute('open'));
});

['Enter', 'Space'].forEach((key) => it(`open-dialog-on-swatch-${key}-keydown`,
      async function() {
        const swatch = getElement(this.el, '#swatch');
        const dialog = getElement(this.el, 'terminal-dialog');

        assert.isFalse(dialog.hasAttribute('open'));

        swatch.dispatchEvent(new KeyboardEvent('keydown', {code: key}));
        await this.el.updateComplete;
        assert.isTrue(dialog.hasAttribute('open'));
      }));

it('updates-and-closes-dialog-when-enter-pressed-in-input', async function() {
  const dialog = getElement(this.el, 'terminal-dialog');
  const swatch = getElement(this.el, '#swatch');
  const hi = getElement(this.el, '#hexinput');

  // Show dialog when swatch clicked.
  assert.isFalse(dialog.hasAttribute('open'));
  swatch.dispatchEvent(new MouseEvent('click'));
  await allUpdatesComplete(this.el);
  assert.isTrue(dialog.hasAttribute('open'));

  // Modify input and press enter.
  hi.value = 'purple';
  hi.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
  await this.waitDialogClose();
  await allUpdatesComplete(this.el);

  // Dialog closed and value updated.
  assert.isFalse(dialog.hasAttribute('open'));
  assert.equal(window.preferenceManager.get(preference), '#A020F0');
  assertInternals(this.el, '#A020F0', 277, 87, 94, 1);
});

it('closes-dialog-when-ok-clicked', async function() {
  const dialog = getElement(this.el, 'terminal-dialog');
  const swatch = getElement(this.el, '#swatch');
  const svp = getElement(this.el, 'saturation-value-picker');

  // Show dialog when swatch clicked.
  assert.isFalse(dialog.hasAttribute('open'));
  swatch.dispatchEvent(new MouseEvent('click'));
  await allUpdatesComplete(this.el);
  assert.isTrue(dialog.hasAttribute('open'));

  // Modify input and click OK.
  svp.saturation = 20;
  svp.value = 80;
  svp.dispatchEvent(new CustomEvent('change'));
  await allUpdatesComplete(this.el);
  dialog.accept();
  await this.waitDialogClose();

  // Dialog closed and value updated.
  assert.isFalse(dialog.hasAttribute('open'));
  assert.equal(
      window.preferenceManager.get(preference), hsvxToCSS([39, 20, 80]));
  assertInternals(this.el, '#CCBEA3', 39, 20, 80, 1);
});

it('closes-dialog-and-reverts-when-cancel-clicked', async function() {
  const dialog = getElement(this.el, 'terminal-dialog');
  const swatch = getElement(this.el, '#swatch');
  const svp = getElement(this.el, 'saturation-value-picker');

  // Show dialog when swatch clicked.
  assert.isFalse(dialog.hasAttribute('open'));
  swatch.dispatchEvent(new MouseEvent('click'));
  await allUpdatesComplete(this.el);
  assert.isTrue(dialog.hasAttribute('open'));

  // Modify input and click OK.
  svp.saturation = 20;
  svp.value = 80;
  svp.dispatchEvent(new CustomEvent('change'));
  await allUpdatesComplete(this.el);
  dialog.cancel();
  await this.waitDialogClose();
  await allUpdatesComplete(this.el);

  // Dialog closed and value updated.
  assert.isFalse(dialog.hasAttribute('open'));
  assert.equal(window.preferenceManager.get(preference), orange);
  assertInternals(this.el, '#FFA600', 39, 100, 100, 1);
});

it('sets-swatch-box-shadows-when-too-white', async function() {
  const swatchDisplay = getElement(this.el, '#swatchdisplay');

  await window.preferenceManager.set(preference, 'white');
  await allUpdatesComplete(this.el);
  assert.isTrue(extractInlineStyle(swatchDisplay, 'box-shadow').includes(
      TOO_WHITE_BOX_SHADOW));

  await window.preferenceManager.set(preference, 'black');
  await allUpdatesComplete(this.el);
  assert.isFalse(extractInlineStyle(swatchDisplay, 'box-shadow').includes(
      TOO_WHITE_BOX_SHADOW));
});

it('sets-swatch-box-shadows-when-dialog-is-opened', async function() {
  const dialog = getElement(this.el, 'terminal-dialog');
  const swatch = getElement(this.el, '#swatch');
  const swatchDisplay = getElement(this.el, '#swatchdisplay');

  // No focus ring when the dialog is closed.
  assert.isFalse(dialog.hasAttribute('open'));
  await allUpdatesComplete(this.el);
  assert.isFalse(extractInlineStyle(swatchDisplay, 'box-shadow').includes(
      FOCUS_BOX_SHADOW));

  await window.preferenceManager.set(preference, 'black');
  swatch.dispatchEvent(new MouseEvent('click'));
  await allUpdatesComplete(this.el);
  assert.isTrue(extractInlineStyle(swatchDisplay, 'box-shadow').includes(
      FOCUS_BOX_SHADOW));
});
