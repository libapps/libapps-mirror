// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview unit tests for terminal_common.js
 */

import {TerminalActiveTracker} from './terminal_active_tracker.js';
import {DEFAULT_BACKGROUND_COLOR, DEFAULT_FONT_SIZE, definePrefs,
    fontFamilyToCSS, normalizePrefsInPlace, parseContainerId, setUpTitleHandler,
    SUPPORTED_FONT_FAMILIES, SUPPORTED_FONT_SIZES} from './terminal_common.js';
import {MockTabsController} from './terminal_test_mocks.js';

const fontFamilies = Array.from(SUPPORTED_FONT_FAMILIES.keys());

describe('terminal_common_tests.js', () => {
  let preferenceManager;
  const mockTabsController = new MockTabsController();

  beforeEach(() => {
    // Mock chrome.tabs because we will use TerminalActiveTracker.
    mockTabsController.start();
    window.localStorage.clear();
    TerminalActiveTracker.resetInstanceForTesting();

    preferenceManager = new lib.PreferenceManager(new lib.Storage.Memory());
    preferenceManager.definePreference('font-family', 'invalid');
  });

  afterEach(() => {
    mockTabsController.stop();
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

  it('setUpTitleHandler-when-no-cache', async () => {
    window.localStorage.removeItem('cachedInitialTitle');
    document.title = 'test title';

    const tracker = await TerminalActiveTracker.get();
    let trackerUpdateCount = 0;
    tracker.maybeUpdateWindowActiveTerminal = () => trackerUpdateCount++;

    const stopHandler = await setUpTitleHandler();

    assert.equal(document.title, 'test title',
        'no cache, title should not change');
    assert.isNull(window.localStorage.getItem('cachedInitialTitle'));

    document.title = 'test title 2';
    await Promise.resolve();
    assert.equal(trackerUpdateCount, 1);

    assert.equal(window.localStorage.getItem('cachedInitialTitle'),
        'test title 2');

    document.title = 'test title 3';
    await Promise.resolve();
    assert.equal(window.localStorage.getItem('cachedInitialTitle'),
        'test title 2',
        'only the first changed title should be written to the cache');
    assert.equal(trackerUpdateCount, 2);

    stopHandler();
  });

  it('setUpTitleHandler-when-has-cache', async () => {
    window.localStorage.setItem('cachedInitialTitle', 'cached title');
    document.title = 'test title';

    const tracker = await TerminalActiveTracker.get();
    let trackerUpdateCount = 0;
    tracker.maybeUpdateWindowActiveTerminal = () => trackerUpdateCount++;

    const stopHandler = await setUpTitleHandler();

    assert.equal(document.title, 'cached title',
        'title should be set to cache');

    await Promise.resolve();
    assert.equal(window.localStorage.getItem('cachedInitialTitle'),
        'cached title');

    document.title = 'test title 2';
    await Promise.resolve();
    assert.equal(window.localStorage.getItem('cachedInitialTitle'),
        'test title 2');
    assert.equal(trackerUpdateCount, 1);

    document.title = 'test title 3';
    await Promise.resolve();
    assert.equal(window.localStorage.getItem('cachedInitialTitle'),
        'test title 2',
        'only the first changed title should be written to the cache');
    assert.equal(trackerUpdateCount, 2);

    stopHandler();
  });

  it('setUpTitleHandler-cache-respects-container-id', async () => {
    const search = '?command=vmshell&args[]=--vm_name=test-vm' +
                   '&args[]=--target_container=test-container';
    const parsedContainerId =
        parseContainerId(new URLSearchParams(search).getAll('args[]'));
    assert.equal(parsedContainerId.vmName, 'test-vm');
    assert.equal(parsedContainerId.containerName, 'test-container');

    document.title = 'test title';
    const key = 'cachedInitialTitle-' +
                '{"vmName":"test-vm","containerName":"test-container"}';

    window.localStorage.setItem(key, 'cached title');
    window.localStorage.setItem('cachedInitialTitle', 'wrong-cached title');

    const tracker = await TerminalActiveTracker.get();
    let trackerUpdateCount = 0;
    tracker.maybeUpdateWindowActiveTerminal = () => trackerUpdateCount++;

    document.location.search = search;
    const stopHandler = await setUpTitleHandler(parsedContainerId);

    assert.equal(
        document.title, 'cached title', 'title should be set to cache');

    await Promise.resolve();
    assert.equal(window.localStorage.getItem(key), 'cached title');

    document.title = 'test title 2';
    await Promise.resolve();
    assert.equal(window.localStorage.getItem(key), 'test title 2');
    assert.equal(trackerUpdateCount, 1);

    document.title = 'test title 3';
    await Promise.resolve();
    assert.equal(
        window.localStorage.getItem(key),
        'test title 2',
        'only the first changed title should be written to the cache');
    assert.equal(trackerUpdateCount, 2);

    stopHandler();
  });
});
