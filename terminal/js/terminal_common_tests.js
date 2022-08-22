// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview unit tests for terminal_common.js
 */

import {DEFAULT_BACKGROUND_COLOR, DEFAULT_FONT_SIZE, SUPPORTED_FONT_FAMILIES,
  SUPPORTED_FONT_SIZES, delayedScheduler, definePrefs, fontFamilyToCSS,
  normalizePrefsInPlace} from './terminal_common.js';

const FONT_FAMILIES = Array.from(SUPPORTED_FONT_FAMILIES.keys());

describe('terminal_common_tests.js', () => {
  beforeEach(function() {
    this.preferenceManager = new lib.PreferenceManager(
        new lib.Storage.Memory());
    this.preferenceManager.definePreference('font-family', 'invalid');
  });

  it('normalizePrefsInPlace', function() {
    const assertNormalizationResult = (pref, before, after) => {
      this.preferenceManager.set(pref, before);
      definePrefs(this.preferenceManager);
      normalizePrefsInPlace(this.preferenceManager);
      assert.equal(this.preferenceManager.get(pref), after);
    };

    assertNormalizationResult('font-family', 'invalid', fontFamilyToCSS(
        FONT_FAMILIES[0]));
    assertNormalizationResult('font-family', FONT_FAMILIES[1],
        fontFamilyToCSS(FONT_FAMILIES[1]));
    assertNormalizationResult('font-family', fontFamilyToCSS(FONT_FAMILIES[1]),
        fontFamilyToCSS(FONT_FAMILIES[1]));
    // Select first valid font if it is a list
    assertNormalizationResult('font-family',
        `invalid, ${FONT_FAMILIES[1]}, ${FONT_FAMILIES[0]}`,
        fontFamilyToCSS(FONT_FAMILIES[1]));

    assertNormalizationResult('font-size', 1000, DEFAULT_FONT_SIZE);
    assertNormalizationResult('font-size', SUPPORTED_FONT_SIZES[0],
        SUPPORTED_FONT_SIZES[0]);

    assertNormalizationResult(
        'background-color', 'invalid', DEFAULT_BACKGROUND_COLOR);
    // Background color's alpha should be reset to 1
    assertNormalizationResult(
        'background-color', '#01020310', '#010203');
    assertNormalizationResult(
        'background-color', 'rgba(1, 2, 3, 0.5)', '#010203');
  });

  it('delayedScheduler', async function() {
    let counter = 0;
    const schedule = delayedScheduler(() => ++counter, 0);
    for (let i = 0; i < 10; ++i) {
      schedule();
    }
    assert.equal(counter, 0);

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(counter, 1);
  });

});
