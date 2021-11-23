// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {terminal} from './terminal.js';
import {TerminalActiveTracker} from './terminal_active_tracker.js';
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

  window.localStorage.clear();
  mockTabsController = new MockTabsController();
  mockTabsController.start();
  TerminalActiveTracker.resetInstanceForTesting();
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
  const tracker = await TerminalActiveTracker.get();

  terminal.init(div);
  const [args, pidInit] =
      await mockTerminalPrivateController.on('openVmshellProcess');
  assert.lengthOf(args, 1);
  assert.match(args[0], /^--startup_id=\d+$/);

  pidInit('terminalId-456');
  assert.equal(tracker.terminalInfo_.terminalId, 'terminalId-456');
});

it('opens-process-in-init-with-parent-terminal', async function() {
  const tracker = await TerminalActiveTracker.get();
  tracker.parentTerminal = {
    tabId: 1,
    title: 't',
    terminalInfo: {
      terminalId: 'terminalId-123',
      containerId: {vmName: 'test-vm', containerName: 'test-container'},
    },
  };

  terminal.init(div);
  const [args] =
      await mockTerminalPrivateController.on('openVmshellProcess');

  assert.lengthOf(args, 4);
  assert.match(args[0], /^--startup_id=\d+$/);
  assert.equal(args[1], '--cwd=terminal_id:terminalId-123');
  assert.equal(args[2], `--vm_name=test-vm`);
  assert.equal(args[3], `--target_container=test-container`);
});

[true, false].map((value) => it(`set-a11y-in-init-to-${value}`, async () => {
  mockTerminalPrivate.a11yStatus = value;
  const term = terminal.init(div);
  await mockTerminalPrivateController.on('getA11yStatus');
  assert.equal(term.accessibilityReader_.accessibilityEnabled, value);
}));

[true, false].map((value) => it(`set-a11y-to-${value}-on-changed`, async () => {
  mockTerminalPrivate.a11yStatus = !value;
  const term = terminal.init(div);
  await mockTerminalPrivateController.on('getA11yStatus');

  await mockTerminalPrivate.onA11yStatusChanged.dispatch(value);
  assert.equal(term.accessibilityReader_.accessibilityEnabled, value);
}));

it('does-not-exit-on-first-output', async function() {
  const pid = 'pid1234';
  mockTerminalPrivate.openVmshellProcessId = pid;
  let exitCalled = false;
  const term = new hterm.Terminal();
  term.decorate(div);
  const terminalCommand = new terminal.Command({term, args: []});
  terminalCommand.run();
  await mockTerminalPrivateController.on('openVmshellProcess');
  terminalCommand.exit = () => { exitCalled = true; };

  await mockTerminalPrivate.onProcessOutput.dispatch(pid, 'exit', 'text');
  assert.isFalse(exitCalled);
  await mockTerminalPrivate.onProcessOutput.dispatch(pid, 'exit', 'text');
  assert.isTrue(exitCalled);
});

it('overrides-ctrl-n-keymap-and-calls-openWindow', async function() {
  let callCount = 0;
  mockTerminalPrivateController.addObserver('openWindow', () => {
    ++callCount;
  });

  const term = terminal.init(div);
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
