// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview unit tests for terminal_common.js
 */

import {normalizePrefsInPlace, SUPPORTED_FONT_FAMILIES, SUPPORTED_FONT_SIZES,
  DEFAULT_FONT_SIZE, COLOR_PREFS} from './terminal_common.js';

describe('terminal_common_tests.js', () => {
  let preferenceManager;
  const defaultColor = 'hsla(1, 2%, 3%, 1)';

  beforeEach(() => {
    preferenceManager = new lib.PreferenceManager(new lib.Storage.Memory());
    preferenceManager.definePreference('font-family', 'invalid');
    preferenceManager.definePreference('font-size', 1000);
    COLOR_PREFS.forEach(
        name => preferenceManager.definePreference(name, defaultColor));
  });

  it('normalizePrefsInPlace', () => {
    function assertNormalizationResult(pref, before, after) {
      preferenceManager.set(pref, before);
      normalizePrefsInPlace(preferenceManager);
      assert.equal(preferenceManager.get(pref), after);
    }

    assertNormalizationResult('font-family', 'invalid',
        SUPPORTED_FONT_FAMILIES[0]);
    assertNormalizationResult('font-family', SUPPORTED_FONT_FAMILIES[1],
        SUPPORTED_FONT_FAMILIES[1]);
    // Select first valid font if it is a list
    assertNormalizationResult('font-family',
        `invalid, ${SUPPORTED_FONT_FAMILIES[1]}, ${SUPPORTED_FONT_FAMILIES[0]}`,
        SUPPORTED_FONT_FAMILIES[1]);

    assertNormalizationResult('font-size', 1000, DEFAULT_FONT_SIZE);
    assertNormalizationResult('font-size', SUPPORTED_FONT_SIZES[0],
        SUPPORTED_FONT_SIZES[0]);

    assertNormalizationResult('background-color', 'invalid',
        defaultColor);
    // Background color's alpha should be reset to 1
    assertNormalizationResult('background-color', '#01020310',
        'hsla(210, 50%, 1%, 1)');
    assertNormalizationResult('background-color', 'rgba(1, 2, 3, 0.5)',
        'hsla(210, 50%, 1%, 1)');

    assertNormalizationResult('foreground-color', 'rgba(1, 2, 3, 0.5)',
        'hsla(210, 50%, 1%, 0.5)');
  });

});
