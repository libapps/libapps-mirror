// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

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

  terminal.init(div, launchInfo);
  const [args, pidInit] =
      await mockTerminalPrivateController.on('openVmshellProcess');
  assert.equal(args.filter((x) => /^--startup_id=\d+$/.test(x)).length, 1);

  pidInit('terminalId-456');
  assert.equal(launchInfo.vsh.terminalId, 'terminalId-456');
});

[true, false].map((value) => it(`set-a11y-in-init-to-${value}`, async () => {
  mockTerminalPrivate.prefs['settings.accessibility'] = value;
  const term = terminal.init(div, newFakeLaunchInfo());
  await waitForPrefLoaded('settings.accessibility');
  assert.equal(term.accessibilityReader_.accessibilityEnabled, value);
}));

[true, false].map((value) => it(`set-a11y-to-${value}-on-changed`, async () => {
  mockTerminalPrivate.prefs['settings.accessibility'] = !value;
  const term = terminal.init(div, newFakeLaunchInfo());
  await waitForPrefLoaded('settings.accessibility');
  await mockTerminalPrivate.onPrefChanged.dispatch(
      {'settings.accessibility': value});
  assert.equal(term.accessibilityReader_.accessibilityEnabled, value);
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

it('overrides-ctrl-n-keymap-and-calls-openWindow', async function() {
  let callCount = 0;
  mockTerminalPrivateController.addObserver('openWindow', () => {
    ++callCount;
  });

  const term = terminal.init(div, newFakeLaunchInfo());
  await mockTerminalPrivateController.on('openVmshellProcess');

  const keyDef = term.keyboard.keyMap.keyDefs[78]; // N.

  /**
   * Get the action with shiftKey set as indicated.
   *
   * @param {boolean} shiftKey
   * @return {!hterm.Keyboard.KeyDefAction}
   */
  function action(shiftKey) {
    const e = new KeyboardEvent('keydown', {shiftKey});
    let control = keyDef.control;
    while (typeof control == 'function') {
      control = control.call(term.keyboard.keyMap, e, keyDef);
    }
    return control;
  }

  // passCtrlN = false, Ctrl+N should send char to terminal.
  term.passCtrlN = false;
  assert.equal('\x0e', action(false));

  // passCtrlN = false, Ctrl+Shift+N should open window.
  assert.equal(hterm.Keyboard.KeyActions.CANCEL, action(true));
  await mockTerminalPrivateController.on('openWindow');
  assert.equal(1, callCount);

  // passCtrlN = true, Ctrl+N should open window.
  term.passCtrlN = true;
  assert.equal(hterm.Keyboard.KeyActions.CANCEL, action(false));
  await mockTerminalPrivateController.on('openWindow');
  assert.equal(2, callCount);

  // passCtrlN = true, Ctrl+Shift+N should open window.
  assert.equal(hterm.Keyboard.KeyActions.CANCEL, action(true));
  await mockTerminalPrivateController.on('openWindow');
  assert.equal(3, callCount);
});
});
