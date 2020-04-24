// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Common code for terminal and it settings page.
 */

// TODO(lxj@google.com) Move code duplicated in both terminal and settings here.

// The value of an entry is true if it is a web font from fonts.google.com,
// otherwise it is a local font. Note that the UI shows the fonts in the same
// order as the entries'.
//
// @type {!Map<string, boolean>}
export const SUPPORTED_FONT_FAMILIES = new Map([
  // The first font is the default font. It must be a local font.
  ['Noto Sans Mono', false],
  ['Cousine', false],
  ['Roboto Mono', true],
  ['Inconsolata', true],
  ['Source Code Pro', true],
]);
export const DEFAULT_FONT_FAMILY = SUPPORTED_FONT_FAMILIES.keys().next().value;
export const SUPPORTED_FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20];

/** @type {!Array<string>} */
export const DEFAULT_ANSI_COLORS = [
  '#80868B',
  '#EE675C',
  '#0AA882',
  '#F9AB00',
  '#669DF6',
  '#EE5FFA',
  '#03BFC8',
  '#BDC1C6',
  '#9AA0A6',
  '#F28B82',
  '#87FFC5',
  '#FDD663',
  '#8AB4F8',
  '#F4B5FB',
  '#80F9F9',
  '#F8F9FA',
];
export const DEFAULT_BACKGROUND_COLOR = '#202124';
export const DEFAULT_BACKGROUND_SIZE = '100% 100%';
export const DEFAULT_FOREGROUND_COLOR = '#FFFFFF';
export const DEFAULT_CURSOR_COLOR = 'rgba(174, 203, 250, 0.5)';
export const DEFAULT_FONT_SIZE = 13;
export const DEFAULT_SCREEN_PADDING_SIZE = 8;
export const DEFAULT_THEME = 'dark';

/**
 * Convert a font family to a CSS string.
 *
 * @param {string} fontFamily one of the font in SUPPORTED_FONT_FAMILIES.
 * @return {string}
 */
export function fontFamilyToCSS(fontFamily) {
  if (fontFamily === DEFAULT_FONT_FAMILY) {
    return fontFamily;
  }
  return `'${fontFamily}', '${DEFAULT_FONT_FAMILY}'`;
}

/**
 * Normalize a css font family string and return one of the font family in
 * SUPPORTED_FONT_FAMILIES.
 *
 * @param {string} cssFontFamily The css font family string.
 * @return {string} The normalized font.
 */
export function normalizeCSSFontFamily(cssFontFamily) {
  for (let fontFamily of cssFontFamily.split(',')) {
    // The regex can never fail, so it is safe to just use the result.
    fontFamily = fontFamily.match(/^\s*['"]?(.*?)['"]?\s*$/)[1];
    if (SUPPORTED_FONT_FAMILIES.has(fontFamily)) {
      return fontFamily;
    }
  }
  return DEFAULT_FONT_FAMILY;
}

/**
 * Define prefs for terminal which are not used by hterm, or that have a
 * different default.
 *
 * @param {!lib.PreferenceManager} prefs The preference manager.
 */
export function definePrefs(prefs) {
  // Set terminal default overrides from hterm.
  prefs.definePreference('audible-bell-sound', '');
  prefs.definePreference('background-color', DEFAULT_BACKGROUND_COLOR);
  prefs.definePreference('background-size', DEFAULT_BACKGROUND_SIZE);
  prefs.definePreference('cursor-color', DEFAULT_CURSOR_COLOR);
  prefs.definePreference('color-palette-overrides', DEFAULT_ANSI_COLORS);
  prefs.definePreference('font-size', DEFAULT_FONT_SIZE);
  prefs.definePreference('foreground-color', DEFAULT_FOREGROUND_COLOR);
  prefs.definePreference('pass-ctrl-tab', true);
  prefs.definePreference('screen-padding-size', DEFAULT_SCREEN_PADDING_SIZE);
  prefs.definePreference('theme', DEFAULT_THEME);
  prefs.definePreference('theme-variations', {});
}

/**
 * Make sure preference values are valid.
 *
 * @param {!lib.PreferenceManager} prefs The preference manager.
 */
export function normalizePrefsInPlace(prefs) {

  prefs.set('font-family', fontFamilyToCSS(normalizeCSSFontFamily(
      /** @type {string} */(prefs.get('font-family')))));

  if (!SUPPORTED_FONT_SIZES.includes(prefs.get('font-size'))) {
    prefs.set('font-size', DEFAULT_FONT_SIZE);
  }

  // Remove alpha from background-color.
  const backgroundColor = lib.colors.normalizeCSS(
      /** @type {string} */(prefs.get('background-color')));
  if (!backgroundColor) {
    // The color value is invalid.
    prefs.reset('background-color');
  } else {
    // Store uppercase hex to help detect when a value is set to default.
    const rgb = lib.colors.setAlpha(backgroundColor, 1);
    prefs.set('background-color', lib.colors.rgbToHex(rgb).toUpperCase());
  }
}

/**
 * Load a web font into a document object.
 *
 * @param {!Document} document The document to load the web font into.
 * @param {string} fontFamily The font family to load.
 * @param {?string=} link_id The id for the <link> element. Existing element
 *     with the same id will be removed first. If this is not specified, a
 *     default value will be used.
 * @return {!Promise<boolean>} Reject if cannot load the font. Otherwise, it
 *     resolves to a boolean indicating whether the font is a web font or not.
 */
export function loadWebFont(document, fontFamily, link_id) {
  return new Promise((resolve, reject) => {
    link_id = link_id || 'terminal:web-font-link';
    if (!SUPPORTED_FONT_FAMILIES.get(fontFamily)) {
      // Not a web font.
      resolve(false);
      return;
    }

    const head = document.querySelector('head');
    let link = head.querySelector(`#${CSS.escape(link_id)}`);
    if (link) {
      link.remove();
    }
    link = document.createElement('link');
    link.id = link_id;
    link.href = `https://fonts.googleapis.com/css2?family=` +
        `${encodeURIComponent(fontFamily)}&display=swap`;
    link.rel = 'stylesheet';
    link.addEventListener('load', async () => {
      // 'X' is the character of which hterm measures the size. For the font
      // size, the default one is used because it probably does not matter.
      const fonts = await document.fonts.load(
          `${DEFAULT_FONT_SIZE}px "${fontFamily}"`, 'X');
      if (fonts.length === 0) {
        reject(new Error('Unable to load fonts'));
      } else {
        resolve(true);
      }
    });
    link.addEventListener('error',
        () => reject(new Error('Unable to load css')));
    head.appendChild(link);
  });
}

/**
 * Add a listener to 'background-color' pref and set
 * <meta id='meta-theme-color' name='theme-color' content="#...">
 * to update tab and frame colors.
 *
 * @param {!lib.PreferenceManager} prefs The preference manager.
 * @param {boolean} updateBody Whether body background should be updated when
 *     background-color pref changes.
 */
export function watchBackgroundColor(prefs, updateBody) {
  prefs.addObserver('background-color', (color) => {
    document.getElementById('meta-theme-color')
        .setAttribute('content', /** @type {string} */ (color));
    if (updateBody) {
      document.body.style.backgroundColor = /** @type {string} */ (color);
    }
  });
}
