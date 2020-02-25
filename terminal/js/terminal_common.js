// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Common code for terminal and it settings page.
 */

// TODO(lxj@google.com) Move code duplicated in both terminal and settings here.

export const SUPPORTED_FONT_FAMILIES = ['Noto Sans Mono', 'Cousine'];
export const SUPPORTED_FONT_SIZES = [6, 8, 10, 12, 14, 16, 18];
export const DEFAULT_FONT_SIZE = 14;

export const COLOR_PREFS = [
    'foreground-color',
    'cursor-color',
    'background-color',
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
 * Normalize a color preference.
 *
 * @param {!lib.PreferenceManager} prefs The target preference manager.
 * @param {string} prefName The preference name.
 * @param {boolean} resetAlpha If true, the alpha will be set to 1.
 */
function normlizeColorInPlace(prefs, prefName, resetAlpha) {
  let color = lib.colors.normalizeCSSToHSL(
      /** @type {string} */(prefs.get(prefName)));
  if (!color) {
    color = lib.notNull(lib.colors.normalizeCSSToHSL(
        /** @type {string} */(prefs.getDefault(prefName))));
  }
  if (resetAlpha) {
    const array = lib.colors.crackHSL(color);
    array[3] = '1';
    color = lib.colors.arrayToHSLA(array);
  }

  prefs.set(prefName, color);
}

/**
 * Make sure preference values are valid.
 *
 * @param {!lib.PreferenceManager} prefs The preference manager.
 */
export function normalizePrefsInPlace(prefs) {
  prefs.set('font-family', normalizeFontFamily(
      /** @type {string} */(prefs.get('font-family'))));

  if (!SUPPORTED_FONT_SIZES.includes(prefs.get('font-size'))) {
    prefs.set('font-size', DEFAULT_FONT_SIZE);
  }

  COLOR_PREFS.forEach(
      name => normlizeColorInPlace(prefs, name, name === 'background-color'));
}
