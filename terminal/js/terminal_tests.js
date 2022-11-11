// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {hterm, lib} from './deps_local.concat.js';

import {terminal} from './terminal.js';
import {MockTabsController, MockTerminalPrivate}
    from './terminal_test_mocks.js';

/**
 * @fileoverview chrome-untrusted://terminal unit tests.
 */

describe('terminal_tests.js', () => {

let mockTerminalPrivate;
let mockTerminalPrivateController;
let mockTabsController;
let div;

const newFakeLaunchInfo = () => ({
  vsh: {
    args: [],
    containerId: {},
    hasCwd: false,
  },
});

const encoder = new TextEncoder();

const waitForPrefLoaded = async function(prefName) {
  while (true) {
    const args = await mockTerminalPrivateController.on('getPrefs');
    if (args[0][0] === prefName) {
      break;
    }
  }
};

/**
 * Create the #terminal div in the document for testing, and start mocks.
 */
beforeEach(function() {
  const document = window.document;
  div = document.createElement('div');
  div.setAttribute('id', 'terminal');
  div.style.position = 'absolute';
  div.style.height = '100%';
  div.style.width = '100%';
  document.body.appendChild(div);
  mockTerminalPrivateController = MockTerminalPrivate.start();
  mockTerminalPrivate = mockTerminalPrivateController.instance;
  mockTerminalPrivate.prefs['crostini.terminal_settings'] = {};
  mockTerminalPrivate.prefs['settings.accessibility'] = false;

  window.localStorage.clear();
  mockTabsController = new MockTabsController();
  mockTabsController.start();
});

/**
 * Remove the #terminal div from the document, and stop mocks.
 */
afterEach(function() {
  document.body.removeChild(div);
  mockTerminalPrivateController.stop();
  mockTabsController.stop();
});

it('opens-process-in-init', async function() {
  const launchInfo = newFakeLaunchInfo();

  await terminal.init(div, launchInfo);
  const [args, pidInit] =
      await mockTerminalPrivateController.on('openVmshellProcess');
  assert.equal(args.filter((x) => /^--startup_id=\d+$/.test(x)).length, 1);

  pidInit('terminalId-456');
  assert.equal(launchInfo.vsh.terminalId, 'terminalId-456');
});

[true, false].map((value) => it(`set-a11y-in-init-to-${value}`, async () => {
  mockTerminalPrivate.prefs['settings.accessibility'] = value;
  const term = await terminal.init(div, newFakeLaunchInfo());
  await waitForPrefLoaded('settings.accessibility');
  assert.equal(term.a11yEnabled_, value);
}));

[true, false].map((value) => it(`set-a11y-to-${value}-on-changed`, async () => {
  mockTerminalPrivate.prefs['settings.accessibility'] = !value;
  const term = await terminal.init(div, newFakeLaunchInfo());
  await waitForPrefLoaded('settings.accessibility');
  await mockTerminalPrivate.onPrefChanged.dispatch(
      {'settings.accessibility': value});
  assert.equal(term.a11yEnabled_, value);
}));

it('does-not-exit-on-first-output', async function() {
  const pid = 'pid1234';
  mockTerminalPrivate.openVmshellProcessId = pid;
  let exitCalled = false;
  const term = new hterm.Terminal({storage: new lib.Storage.Memory()});
  term.decorate(div);
  const terminalCommand = new terminal.Command(term);
  terminalCommand.run(newFakeLaunchInfo());
  await mockTerminalPrivateController.on('openVmshellProcess');
  terminalCommand.exit = () => { exitCalled = true; };

  await mockTerminalPrivate.onProcessOutput.dispatch(pid, 'exit',
      encoder.encode('text').buffer);
  assert.isFalse(exitCalled);
  await mockTerminalPrivate.onProcessOutput.dispatch(pid, 'exit',
      encoder.encode('text').buffer);
  assert.isTrue(exitCalled);
});
});
