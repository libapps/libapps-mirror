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

/**
 * Return a normalized font family.
 *
 * @param {string} cssFontFamily
 * @return {string} The normalized font
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
 * @param {!lib.PreferenceManager} prefs
 */
export function normalizePrefsInPlace(prefs) {
  prefs.set('font-family', normalizeFontFamily(
      /** @type {string} */(prefs.get('font-family'))));

  if (!SUPPORTED_FONT_SIZES.includes(prefs.get('font-size'))) {
    prefs.set('font-size', DEFAULT_FONT_SIZE);
  }

  const backgroundColor = lib.colors.normalizeCSS(
      /** @type {string} */(prefs.get('background-color')));
  if (!backgroundColor) {
    // The color value is invalid.
    prefs.reset('background-color');
  } else {
    prefs.set('background-color', lib.colors.setAlpha( backgroundColor, 1));
  }
}
