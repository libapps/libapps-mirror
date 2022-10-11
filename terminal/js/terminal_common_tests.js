// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview unit tests for terminal_common.js
 */

import {DEFAULT_BACKGROUND_COLOR, SUPPORTED_FONT_FAMILIES,
  SUPPORTED_FONT_FAMILIES_MINIMAL, delayedScheduler, definePrefs,
  fontFamilyToCSS, getSupportedFontFamilies, normalizeCSSFontFamily,
  normalizePrefsInPlace} from './terminal_common.js';

describe('terminal_common_tests.js', () => {
  beforeEach(function() {
    this.preferenceManager = new lib.PreferenceManager(
        new lib.Storage.Memory());
    this.preferenceManager.definePreference('font-family', 'invalid');
    this.preferenceManager.definePreference('terminal-emulator', 'xterm.js');
  });

  it('getSupportedFontFamilies', function() {
    this.preferenceManager.set('terminal-emulator', 'xterm.js');
    assert.equal(
        getSupportedFontFamilies(this.preferenceManager),
        SUPPORTED_FONT_FAMILIES);
    this.preferenceManager.set('terminal-emulator', 'hterm');
    assert.equal(
        getSupportedFontFamilies(this.preferenceManager),
        SUPPORTED_FONT_FAMILIES_MINIMAL);
  });

  it('fontFamilyToCSS', function() {
    assert.equal(fontFamilyToCSS('Noto Sans Mono'),
        `'Noto Sans Mono', 'Powerline For Noto Sans Mono'`);
    assert.equal(fontFamilyToCSS('Anonymous Pro'),
        `'Anonymous Pro', 'Noto Sans Mono'`);
  });

  it('normalizeCSSFontFamily', function() {
    assert.equal(normalizeCSSFontFamily('invalid'), 'Noto Sans Mono');
    assert.equal(normalizeCSSFontFamily(`'Cousine'`), 'Cousine');
    assert.equal(normalizeCSSFontFamily(
        `invalid, 'Roboto Mono', 'Cousine'`), 'Roboto Mono');
  });

  it('normalizePrefsInPlace', function() {
    const assertNormalizationResult = (pref, before, after) => {
      definePrefs(this.preferenceManager);
      this.preferenceManager.set(pref, before);
      normalizePrefsInPlace(this.preferenceManager);
      assert.equal(this.preferenceManager.get(pref), after);
    };

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
    const schedule = delayedScheduler(() => ++counter, 50);
    const promise = schedule();
    for (let i = 0; i < 10; ++i) {
      schedule();
    }
    assert.equal(counter, 0);

    await promise;
    assert.equal(counter, 1);
  });

});
