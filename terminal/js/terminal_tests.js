// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {terminal} from './terminal.js';

/**
 * @fileoverview chrome-untrusted://terminal unit tests.
 */

describe('terminal_tests.js', () => {

let mockTerminalPrivate;
let mockTerminalPrivateController;
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
});

/**
 * Remove the #terminal div from the document, and stop mocks.
 */
afterEach(function() {
  document.body.removeChild(div);
  mockTerminalPrivateController.stop();
});

it('opens-process-in-init', async function() {
  terminal.init(div);
  const [args] =
      await mockTerminalPrivateController.on('openVmshellProcess');
  assert.lengthOf(args, 1);
  assert.match(args[0], /^--startup_id=\d+$/);
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
  const term = terminal.init(div);
  await mockTerminalPrivateController.on('openVmshellProcess');
  term.command.exit = () => { exitCalled = true; };

  await mockTerminalPrivate.onProcessOutput.dispatch(pid, 'exit', 'text');
  assert.isFalse(exitCalled);
  await mockTerminalPrivate.onProcessOutput.dispatch(pid, 'exit', 'text');
  assert.isTrue(exitCalled);
});

it('migrates-settings-on-first-run-only', async function() {
  const getItems = async () => {
    return new Promise((resolve) => {
      hterm.defaultStorage.getItems(null, resolve);
    });
  };

  let callCount = 0;
  mockTerminalPrivateController.addObserver('getCroshSettings', () => {
    ++callCount;
  });

  // First time calls getCroshSettings and copies settings.
  mockTerminalPrivate.croshSettings = {'test': 1};
  await terminal.migrateSettings();
  assert.equal(callCount, 1);
  let settings = await getItems();
  assert.deepInclude(settings, {'test': 1, 'crosh.settings.migrated': true});

  // Once migrated, doesn't call getCroshSettings again, or update settings.
  mockTerminalPrivate.croshSettings = {'test': 2};
  await terminal.migrateSettings();
  assert.equal(callCount, 1);
  settings = await getItems();
  assert.deepInclude(settings, {'test': 1, 'crosh.settings.migrated': true});
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
