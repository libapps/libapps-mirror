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
  // The first font is the default font.
  ['Noto Sans Mono', false],
  ['Cousine', false],
  ['Roboto Mono', true],
  ['Inconsolata', true],
  ['Source Code Pro', true],
]);
export const SUPPORTED_FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20];
export const DEFAULT_FONT_SIZE = 13;

export const DEFAULT_BACKGROUND_COLOR = '#202124';
export const DEFAULT_FOREGROUND_COLOR = '#FFFFFF';
export const DEFAULT_CURSOR_COLOR = '#AECBFA';
/** @type {!Array<string>} */
export const DEFAULT_ANSI_COLORS = [
  '#9AA0A6',
  '#F28B82',
  '#87FFC5',
  '#FDD663',
  '#8AB4F8',
  '#F4B5FB',
  '#80F9F9',
  '#F8F9FA',
  '#80868B',
  '#EE675C',
  '#0AA882',
  '#F9AB00',
  '#669DF6',
  '#EE5FFA',
  '#03BFC8',
  '#BDC1C6',
];

/**
 * Return a normalized font family.
 *
 * @param {string} cssFontFamily The font family.
 * @return {string} The normalized font.
 */
function normalizeFontFamily(cssFontFamily) {
  for (let fontFamily of cssFontFamily.split(',')) {
    fontFamily = fontFamily.trim();
    if (SUPPORTED_FONT_FAMILIES.has(fontFamily)) {
      return fontFamily;
    }
  }
  return SUPPORTED_FONT_FAMILIES.keys().next().value;
}

/**
 * Make sure preference values are valid.
 *
 * @param {!lib.PreferenceManager} prefs The preference manager.
 */
export function normalizePrefsInPlace(prefs) {
  // Set terminal default overrides from hterm.
  // TODO(joelhockey): Separate setting these defaults from normalizing values.
  prefs.definePreference('font-size', DEFAULT_FONT_SIZE);
  prefs.definePreference('background-color', DEFAULT_BACKGROUND_COLOR);
  prefs.definePreference('foreground-color', DEFAULT_FOREGROUND_COLOR);
  prefs.definePreference('cursor-color', DEFAULT_CURSOR_COLOR);
  prefs.definePreference('color-palette-overrides', DEFAULT_ANSI_COLORS);
  prefs.definePreference('pass-ctrl-tab', true);

  prefs.set('font-family', normalizeFontFamily(
      /** @type {string} */(prefs.get('font-family'))));

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
    prefs.set('background-color', lib.colors.setAlpha(backgroundColor, 1));
  }
}

/**
 * Load a web font into a document object.
 *
 * @param {!Document} document The document to load the web font into.
 * @param {string} fontFamily The font family to load.
 * @return {!Promise<boolean>} False if the font is not a web font.
 */
export function loadWebFont(document, fontFamily) {
  return new Promise((resolve, reject) => {
    const LINK_ID = 'terminal:web-font-link';
    if (!SUPPORTED_FONT_FAMILIES.get(fontFamily)) {
      // Not a web font.
      resolve(false);
      return;
    }

    const head = document.querySelector('head');
    let link = head.querySelector(`#${CSS.escape(LINK_ID)}`);
    if (link) {
      link.remove();
    }
    link = document.createElement('link');
    link.id = LINK_ID;
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
