// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview unit tests for terminal_common.js
 */

import {DEFAULT_BACKGROUND_COLOR, DEFAULT_FONT_SIZE, SUPPORTED_FONT_FAMILIES,
  SUPPORTED_FONT_SIZES, definePrefs, normalizePrefsInPlace, fontFamilyToCSS,
  setUpTitleCacheHandler} from './terminal_common.js';

const fontFamilies = Array.from(SUPPORTED_FONT_FAMILIES.keys());

describe('terminal_common_tests.js', () => {
  let preferenceManager;

  beforeEach(() => {
    preferenceManager = new lib.PreferenceManager(new lib.Storage.Memory());
    preferenceManager.definePreference('font-family', 'invalid');
  });

  it('normalizePrefsInPlace', () => {
    function assertNormalizationResult(pref, before, after) {
      preferenceManager.set(pref, before);
      definePrefs(preferenceManager);
      normalizePrefsInPlace(preferenceManager);
      assert.equal(preferenceManager.get(pref), after);
    }

    assertNormalizationResult('font-family', 'invalid', fontFamilyToCSS(
        fontFamilies[0]));
    assertNormalizationResult('font-family', fontFamilies[1],
        fontFamilyToCSS(fontFamilies[1]));
    assertNormalizationResult('font-family', fontFamilyToCSS(fontFamilies[1]),
        fontFamilyToCSS(fontFamilies[1]));
    // Select first valid font if it is a list
    assertNormalizationResult('font-family',
        `invalid, ${fontFamilies[1]}, ${fontFamilies[0]}`,
        fontFamilyToCSS(fontFamilies[1]));

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

  it('setUpTitleCacheHandler-when-no-cache', async () => {
    window.localStorage.removeItem('cachedTitle');
    document.title = 'test title';

    setUpTitleCacheHandler();

    assert.equal(document.title, 'test title',
        'no cache, title should not change');
    assert.isNull(window.localStorage.getItem('cachedTitle'));

    document.title = 'test title 2';
    await Promise.resolve();
    assert.equal(window.localStorage.getItem('cachedTitle'), 'test title 2');

    document.title = 'test title 3';
    await Promise.resolve();
    assert.equal(window.localStorage.getItem('cachedTitle'), 'test title 2',
        'only the first changed title should be written to the cache');
  });

  it('setUpTitleCacheHandler-when-has-cache', async () => {
    window.localStorage.setItem('cachedTitle', 'cached title');
    document.title = 'test title';

    setUpTitleCacheHandler();

    assert.equal(document.title, 'cached title',
        'title should be set to cache');

    await Promise.resolve();
    assert.equal(window.localStorage.getItem('cachedTitle'), 'cached title');

    document.title = 'test title 2';
    await Promise.resolve();
    assert.equal(window.localStorage.getItem('cachedTitle'), 'test title 2');

    document.title = 'test title 3';
    await Promise.resolve();
    assert.equal(window.localStorage.getItem('cachedTitle'), 'test title 2',
        'only the first changed title should be written to the cache');
  });
});
