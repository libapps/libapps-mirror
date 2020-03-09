// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Common code for terminal and it settings page.
 */

// TODO(lxj@google.com) Move code duplicated in both terminal and settings here.

export const SUPPORTED_FONT_FAMILIES = ['Noto Sans Mono', 'Cousine'];
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
    if (SUPPORTED_FONT_FAMILIES.includes(fontFamily)) {
      return fontFamily;
    }
  }
  return SUPPORTED_FONT_FAMILIES[0];
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
