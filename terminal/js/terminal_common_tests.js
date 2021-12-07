// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview unit tests for terminal_common.js
 */

import {TerminalActiveTracker} from './terminal_active_tracker.js';
import {DEFAULT_BACKGROUND_COLOR, DEFAULT_CONTAINER_NAME, DEFAULT_FONT_SIZE,
  DEFAULT_VM_NAME, SUPPORTED_FONT_FAMILIES, SUPPORTED_FONT_SIZES, definePrefs,
  fontFamilyToCSS, getInitialTitleCacheKey, getTerminalLaunchInfo,
  normalizePrefsInPlace, setUpTitleHandler, TerminalLaunchInfo}
    from './terminal_common.js';
import {MockTabsController} from './terminal_test_mocks.js';

const FONT_FAMILIES = Array.from(SUPPORTED_FONT_FAMILIES.keys());
const DEFAULT_CONTAINER = {
  vmName: DEFAULT_VM_NAME,
  containerName: DEFAULT_CONTAINER_NAME,
};

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

  describe('setupTitleHandler() for vsh', function() {

    beforeEach(function() {
      // Mock chrome.tabs because we will use TerminalActiveTracker.
      this.mockTabsController = new MockTabsController();
      this.mockTabsController.start();
      window.localStorage.clear();
      TerminalActiveTracker.resetInstanceForTesting();
    });

    afterEach(function() {
      this.mockTabsController.stop();
    });

    it('default container with no cache', async function() {
      const key = getInitialTitleCacheKey(DEFAULT_CONTAINER);
      window.localStorage.removeItem(key);
      document.title = 'test title';

      const tracker = await TerminalActiveTracker.get();
      let trackerUpdateCount = 0;
      tracker.maybeUpdateWindowActiveTerminal = () => trackerUpdateCount++;

      const stopHandler = await setUpTitleHandler({
        vsh: {
          args: [],
          containerId: DEFAULT_CONTAINER,
          hasCwd: false,
        },
      });

      assert.equal(document.title, 'test title',
          'no cache, title should not change');
      assert.isNull(window.localStorage.getItem(key));

      document.title = 'test title 2';
      await Promise.resolve();
      assert.equal(trackerUpdateCount, 1);

      assert.equal(window.localStorage.getItem(key),
          'test title 2');

      document.title = 'test title 3';
      await Promise.resolve();
      assert.equal(window.localStorage.getItem(key),
          'test title 2',
          'only the first changed title should be written to the cache');
      assert.equal(trackerUpdateCount, 2);

      stopHandler();
    });

    [
        DEFAULT_CONTAINER,
        {vmName: 'vm0', containerName: 'container0'},
    ].forEach(function(containerId) {
      it(`has cache (${JSON.stringify(containerId)})`, async function() {
        const key = getInitialTitleCacheKey(containerId);
        window.localStorage.setItem(key, 'cached title');
        document.title = 'test title';

        const tracker = await TerminalActiveTracker.get();
        let trackerUpdateCount = 0;
        tracker.maybeUpdateWindowActiveTerminal = () => trackerUpdateCount++;

        const stopHandler = await setUpTitleHandler({
          vsh: {
            containerId,
            hasCwd: false,
            // args does not matter.
            args: [],
          },
        });

        assert.equal(document.title, 'cached title',
            'title should be set to cache');

        await Promise.resolve();
        assert.equal(window.localStorage.getItem(key),
            'cached title');

        document.title = 'test title 2';
        await Promise.resolve();
        assert.equal(window.localStorage.getItem(key),
            'test title 2');
        assert.equal(trackerUpdateCount, 1);

        document.title = 'test title 3';
        await Promise.resolve();
        assert.equal(window.localStorage.getItem(key),
            'test title 2',
            'only the first changed title should be written to the cache');
        assert.equal(trackerUpdateCount, 2);

        stopHandler();
      });
    });
  });

  describe('getTerminalLaunchInfo() for vsh', function() {
    const emptyActiveTracker = /** @type {!TerminalActiveTracker} */({});
    const activeTrackerWithoutTerminalId =
        /** @type {!TerminalActiveTracker} */({
          parentTerminal: {
            terminalInfo: {
              containerId: {
                vmName: 'vm0',
                containerName: 'container0',
              },
            },
          },
        });
    const activeTrackerWithTerminalId =
        /** @type {!TerminalActiveTracker} */({
          parentTerminal: {
            terminalInfo: {
              terminalId: 'tid0',
              containerId: {
                vmName: 'vm0',
                containerName: 'container0',
              },
            },
          },
        });

    /**
     * A helper function which builds a url from `args` and calls
     * getTerminalLaunchInfo().
     *
     * @param {!TerminalActiveTracker} activeTracker
     * @param {!Array<string>} args Arguments to be put into url params 'args[]'
     * @return {!TerminalLaunchInfo}
     */
    const getTerminalLaunchInfoWithArgs = (activeTracker, args) => {
      const url = new URL(location.href);
      url.search = (new URLSearchParams(args.map((value) => ['args[]', value])))
          .toString();
      return getTerminalLaunchInfo(activeTracker, url);
    };

    function assertVshInfoEqual(vshInfo0, vshInfo1) {
      // getTerminalLaunchInfo() might change the order of some args, so we sort
      // them first.
      assert.deepEqual(
          {...vshInfo0, args: [...vshInfo0.args].sort()},
          {...vshInfo1, args: [...vshInfo1.args].sort()},
      );
    }

    describe('containerId', function() {
      it('always uses args\' if it exists', function() {
        assertVshInfoEqual(
            getTerminalLaunchInfoWithArgs(
                activeTrackerWithoutTerminalId,
                ['a', 'b', '--vm_name=aaa'],
            ).vsh,
            {
              args: ['a', 'b', '--vm_name=aaa'],
              containerId: {vmName: 'aaa'},
              hasCwd: false,
            },
        );

        assertVshInfoEqual(
            getTerminalLaunchInfoWithArgs(
                activeTrackerWithoutTerminalId,
                ['a', 'b', '--target_container=bbb'],
            ).vsh,
            {
              args: ['a', 'b', '--target_container=bbb'],
              containerId: {containerName: 'bbb'},
              hasCwd: false,
            },
        );

        assertVshInfoEqual(
            getTerminalLaunchInfoWithArgs(
                activeTrackerWithoutTerminalId,
                ['a', 'b', '--vm_name=aaa', '--target_container=bbb'],
            ).vsh,
            {
              args: ['a', 'b', '--vm_name=aaa', '--target_container=bbb'],
              containerId: {vmName: 'aaa', containerName: 'bbb'},
              hasCwd: false,
            },
        );
      });

      it('uses parent\'s if args\' is missing', function() {
        assertVshInfoEqual(
            getTerminalLaunchInfoWithArgs(
                activeTrackerWithoutTerminalId,
                ['a', 'b'],
            ).vsh,
            {
              args: ['a', 'b', '--vm_name=vm0',
              '--target_container=container0'],
              containerId: {
                vmName: 'vm0',
                containerName: 'container0',
              },
              hasCwd: false,
            },
        );
      });

      it('uses default as a fallback', function() {
        assertVshInfoEqual(
            getTerminalLaunchInfoWithArgs(emptyActiveTracker, ['a', 'b']).vsh,
            {
              args: ['a', 'b', `--vm_name=${DEFAULT_VM_NAME}`,
                  `--target_container=${DEFAULT_CONTAINER_NAME}`],
              containerId: {
                vmName: DEFAULT_VM_NAME,
                containerName: DEFAULT_CONTAINER_NAME,
              },
              hasCwd: false,
            },
        );
      });
    });

    describe('cwd', function() {
      it('always uses args\' if it exists', function() {
        assertVshInfoEqual(
            getTerminalLaunchInfoWithArgs(
                emptyActiveTracker,
                ['a', 'b', '--cwd=some-cwd'],
            ).vsh,
            {
              args: ['a', 'b', `--vm_name=${DEFAULT_VM_NAME}`,
                  `--target_container=${DEFAULT_CONTAINER_NAME}`,
                  '--cwd=some-cwd'],
              containerId: {
                vmName: DEFAULT_VM_NAME,
                containerName: DEFAULT_CONTAINER_NAME,
              },
              hasCwd: true,
            },
        );

        assertVshInfoEqual(
            getTerminalLaunchInfoWithArgs(
                activeTrackerWithTerminalId,
                ['a', 'b', '--cwd=some-cwd'],
            ).vsh,
            {
              args: ['a', 'b', '--vm_name=vm0',
                '--target_container=container0', '--cwd=some-cwd'],
              containerId: {vmName: 'vm0', containerName: 'container0'},
              hasCwd: true,
            },
        );
      });

      it('follows parent\'s if has the same container', function() {
        assertVshInfoEqual(
            getTerminalLaunchInfoWithArgs(
                activeTrackerWithTerminalId,
                ['a', 'b'],
            ).vsh,
            {
              args: ['a', 'b', '--vm_name=vm0',
                '--target_container=container0', '--cwd=terminal_id:tid0'],
              containerId: {vmName: 'vm0', containerName: 'container0'},
              hasCwd: true,
            },
        );

        assertVshInfoEqual(
            getTerminalLaunchInfoWithArgs(
                activeTrackerWithTerminalId,
                ['a', 'b', '--vm_name=vm0', '--target_container=container0'],
            ).vsh,
            {
              args: ['a', 'b', '--vm_name=vm0',
                '--target_container=container0', '--cwd=terminal_id:tid0'],
              containerId: {vmName: 'vm0', containerName: 'container0'},
              hasCwd: true,
            },
        );

        // Not the same container.
        assertVshInfoEqual(
            getTerminalLaunchInfoWithArgs(
                activeTrackerWithTerminalId,
                ['a', 'b', '--vm_name=vm0', '--target_container=container1'],
            ).vsh,
            {
              args: ['a', 'b', '--vm_name=vm0',
                '--target_container=container1'],
              containerId: {vmName: 'vm0', containerName: 'container1'},
              hasCwd: false,
            },
        );
      });
    });
  });
});
