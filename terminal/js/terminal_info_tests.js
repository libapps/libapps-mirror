// Copyright 2021 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview unit tests for terminal_info.js
 */

import {DEFAULT_VM_NAME, DEFAULT_CONTAINER_NAME} from './terminal_common.js';
import {LaunchInfo, TerminalInfoTracker, getInitialTitleCacheKey,
  setUpTitleHandler, resolveLaunchInfo} from './terminal_info.js';
import {MockObject} from './terminal_test_mocks.js';

const DEFAULT_CONTAINER = {
  vmName: DEFAULT_VM_NAME,
  containerName: DEFAULT_CONTAINER_NAME,
};

describe('terminal_info_tests.js', () => {
  describe('resolveLaunchInfo for home', function() {
    it('follows url', function() {
      const parentLaunchInfo = /** @type {!LaunchInfo} */({
        ssh: {},
      });

      assert.deepEqual(
          resolveLaunchInfo(parentLaunchInfo,
            new URL('/html/terminal.html#home', location.href)).home,
          {});

      // The ssh page without hash should be considered the home page.
      assert.deepEqual(
          resolveLaunchInfo(parentLaunchInfo,
            new URL('/html/terminal_ssh.html', location.href)).home,
          {});
    });

    it('follows parent', function() {
      const parentLaunchInfo = /** @type {!LaunchInfo} */({
        home: {},
      });

      const url = new URL(location.href);
      url.search = '';

      // No parent.
      assert.isUndefined(resolveLaunchInfo(/** @type {!LaunchInfo} */({}),
            url).home);

      // Has parent at the home page.
      assert.deepEqual(resolveLaunchInfo(parentLaunchInfo, url).home, {});

      // Has parent but there is a url param.
      url.search = '?vm=penguin';
      assert.isUndefined(
          resolveLaunchInfo(parentLaunchInfo, url).home);
    });
  });

  describe('resolveLaunchInfo for tmux', function() {
    it('follows parent', function() {
      const parentLaunchInfo = /** @type {!LaunchInfo} */({
        tmux: {
          driverChannelName: 'abcd',
        },
      });

      const url = new URL(location.href);
      url.search = '';

      // No parent.
      assert.isUndefined(resolveLaunchInfo(/** @type {!LaunchInfo} */({}),
            url).tmux);

      // Has parent with driver channel.
      assert.deepEqual(
          resolveLaunchInfo(parentLaunchInfo, url).tmux,
          {driverChannelName: 'abcd'},
      );

      // Has parent but there is a url param.
      url.search = '?vm=penguin';
      assert.isUndefined(
          resolveLaunchInfo(parentLaunchInfo, url).tmux);
    });
  });

  describe('resolveLaunchInfo() for vsh', function() {
    const emptyParent = /** @type {!LaunchInfo} */({});
    const parentWithoutTerminalId = /** @type {!LaunchInfo} */({
      vsh: {
        args: [],
        containerId: {
          vmName: 'vm0',
          containerName: 'container0',
        },
      },
    });
    const parentWithTerminalId = /** @type {!LaunchInfo} */({
      vsh: {
        args: [],
        terminalId: 'tid0',
        containerId: {
          vmName: 'vm0',
          containerName: 'container0',
        },
      },
    });

    /**
     * A helper function which builds a url from `args` and calls
     * resolveLaunchInfo().
     *
     * @param {!LaunchInfo} parentLaunchInfo
     * @param {!Array<string>} args Arguments to be put into url params 'args[]'
     * @return {!LaunchInfo}
     */
    const resolveLaunchInfoWithArgs = (parentLaunchInfo, args) => {
      const url = new URL(location.href);
      url.search = (new URLSearchParams(args.map((value) => ['args[]', value])))
          .toString();
      return resolveLaunchInfo(parentLaunchInfo, url);
    };

    function assertVshInfoEqual(vshInfo0, vshInfo1) {
      // resolveLaunchInfo() might change the order of some args, so we sort
      // them first.
      assert.deepEqual(
          {...vshInfo0, args: [...vshInfo0.args].sort()},
          {...vshInfo1, args: [...vshInfo1.args].sort()},
      );
    }

    describe('containerId', function() {
      it('always uses args\' if it exists', function() {
        assertVshInfoEqual(
            resolveLaunchInfoWithArgs(
                parentWithoutTerminalId,
                ['a', 'b', '--vm_name=aaa'],
            ).vsh,
            {
              args: ['a', 'b', '--vm_name=aaa'],
              containerId: {vmName: 'aaa'},
              hasCwd: false,
            },
        );

        assertVshInfoEqual(
            resolveLaunchInfoWithArgs(
                parentWithoutTerminalId,
                ['a', 'b', '--target_container=bbb'],
            ).vsh,
            {
              args: ['a', 'b', '--target_container=bbb'],
              containerId: {containerName: 'bbb'},
              hasCwd: false,
            },
        );

        assertVshInfoEqual(
            resolveLaunchInfoWithArgs(
                parentWithoutTerminalId,
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
            resolveLaunchInfoWithArgs(
                parentWithoutTerminalId,
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
            resolveLaunchInfoWithArgs(emptyParent, ['a', 'b']).vsh,
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
            resolveLaunchInfoWithArgs(
                emptyParent,
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
            resolveLaunchInfoWithArgs(
                parentWithTerminalId,
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
            resolveLaunchInfoWithArgs(
                parentWithTerminalId,
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
            resolveLaunchInfoWithArgs(
                parentWithTerminalId,
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
            resolveLaunchInfoWithArgs(
                parentWithTerminalId,
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

  describe('TerminalInfoTracker', function() {
    beforeEach(function() {
      this.mockChannel = new MockObject({onmessage: null});
      document.title = 'TerminalInfoTracker';
      this.newTracker = () => new TerminalInfoTracker({
        tabId: 123,
        channel: this.mockChannel.proxy,
        launchInfo: {crosh: {}},
        parentTitle: '',
      });
    });

    it('postInfo upon construction', function() {
      this.newTracker();
      assert.deepEqual(this.mockChannel.getMethodHistory('postMessage'), [[{
        tabId: 123,
        title: 'TerminalInfoTracker',
        launchInfo: {crosh: {}},
      }]]);
    });

    it('postInfo upon request', function() {
      this.newTracker();
      this.mockChannel.popMethodHistory('postMessage');
      document.title = 'TerminalInfoTracker 2';
      this.mockChannel.proxy.onmessage({data: 123});
      assert.deepEqual(this.mockChannel.getMethodHistory('postMessage'), [[{
        tabId: 123,
        title: 'TerminalInfoTracker 2',
        launchInfo: {crosh: {}},
      }]]);
    });

    it('requestTerminalInfo', async function() {
      assert.isNull(await TerminalInfoTracker.requestTerminalInfo(
          this.mockChannel.proxy, null));
      assert.deepEqual(this.mockChannel.popMethodHistory('postMessage'), []);

      const promise =
          TerminalInfoTracker.requestTerminalInfo(this.mockChannel.proxy, 123);
      assert.deepEqual(this.mockChannel.popMethodHistory('postMessage'),
          [[123]]);
      this.mockChannel.proxy.onmessage({data: 123});
      this.mockChannel.proxy.onmessage({data: {tabId: 789}});
      this.mockChannel.proxy.onmessage({data: {tabId: 123}});
      assert.deepEqual(await promise, {tabId: 123});
    });

    it('requestTerminalInfo timeout', async function() {
      const promise = TerminalInfoTracker.requestTerminalInfo(
              this.mockChannel.proxy, 123, 0);
      await Promise.resolve();
      assert.isNull(await promise);
    });

  });

  describe('setupTitleHandler() for vsh', function() {

    beforeEach(function() {
      window.localStorage.clear();
    });

    it('default container with no cache', async function() {
      const key = getInitialTitleCacheKey(DEFAULT_CONTAINER);
      window.localStorage.removeItem(key);
      document.title = 'test title';

      await setUpTitleHandler(/** @type {!TerminalInfoTracker} */({
        launchInfo: {
          vsh: {
            args: [],
            containerId: DEFAULT_CONTAINER,
            hasCwd: false,
          },
        },
      }));

      assert.equal(document.title, 'test title',
          'no cache, title should not change');
      assert.isNull(window.localStorage.getItem(key));

      document.title = 'test title 2';
      await Promise.resolve();
      assert.equal(window.localStorage.getItem(key),
          'test title 2');

      document.title = 'test title 3';
      await Promise.resolve();
      assert.equal(window.localStorage.getItem(key),
          'test title 2',
          'only the first changed title should be written to the cache');
    });

    [
        DEFAULT_CONTAINER,
        {vmName: 'vm0', containerName: 'container0'},
    ].forEach(function(containerId) {
      it(`has cache (${JSON.stringify(containerId)})`, async function() {
        const key = getInitialTitleCacheKey(containerId);
        window.localStorage.setItem(key, 'cached title');
        document.title = 'test title';

        await setUpTitleHandler(/** @type {!TerminalInfoTracker} */({
          launchInfo: {
            vsh: {
              containerId,
              hasCwd: false,
              // args does not matter.
              args: [],
            },
          },
        }));

        assert.equal(document.title, 'cached title',
            'title should be set to cache');

        await Promise.resolve();
        assert.equal(window.localStorage.getItem(key),
            'cached title');

        document.title = 'test title 2';
        await Promise.resolve();
        assert.equal(window.localStorage.getItem(key),
            'test title 2');

        document.title = 'test title 3';
        await Promise.resolve();
        assert.equal(window.localStorage.getItem(key),
            'test title 2',
            'only the first changed title should be written to the cache');
      });
    });
  });
});
