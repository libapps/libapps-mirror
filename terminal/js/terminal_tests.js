// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {terminal} from './terminal.js';

/**
 * @fileoverview chrome://terminal unit tests.
 */

describe('terminal_tests.js', () => {

/**
 * Create the #terminal div in the document for testing, and start mocks.
 */
beforeEach(function() {
  const document = window.document;
  const div = this.div = document.createElement('div');
  div.setAttribute('id', 'terminal');
  div.style.position = 'absolute';
  div.style.height = '100%';
  div.style.width = '100%';
  document.body.appendChild(div);
  this.mockTerminalPrivateController = MockTerminalPrivate.start();
  this.mockTerminalPrivate = this.mockTerminalPrivateController.instance;
});

/**
 * Remove the #terminal div from the document, and stop mocks.
 */
afterEach(function() {
  document.body.removeChild(this.div);
  this.mockTerminalPrivateController.stop();
});

it('opens-process-in-init', async function() {
  terminal.init(this.div);
  const [processName, args] =
      await this.mockTerminalPrivateController.on('openTerminalProcess');
  assert.equal('vmshell', processName);
  assert.lengthOf(args, 1);
  assert.match(args[0], /^--startup_id=\d+$/);
});

it('does-not-exit-on-first-output', async function() {
  const pid = 'pid1234';
  this.mockTerminalPrivate.openTerminalProcessId = pid;
  let exitCalled = false;
  const term = terminal.init(this.div);
  await this.mockTerminalPrivateController.on('openTerminalProcess');
  term.command.exit = () => { exitCalled = true; };

  await this.mockTerminalPrivate.onProcessOutput.dispatch(pid, 'exit', 'text');
  assert.isFalse(exitCalled);
  await this.mockTerminalPrivate.onProcessOutput.dispatch(pid, 'exit', 'text');
  assert.isTrue(exitCalled);
});

it('migrates-settings-on-first-run-only', async function() {
  const getItems = async () => {
    return new Promise((resolve) => {
      hterm.defaultStorage.getItems(null, resolve);
    });
  };

  let callCount = 0;
  this.mockTerminalPrivateController.addObserver('getCroshSettings', () => {
    ++callCount;
  });

  // First time calls getCroshSettings and copies settings.
  this.mockTerminalPrivate.croshSettings = {'test': 1};
  await new Promise((resolve) => terminal.migrateSettings(resolve));
  assert.equal(callCount, 1);
  let settings = await getItems();
  assert.deepEqual(settings, {'test': 1, 'crosh.settings.migrated': true});

  // Once migrated, doesn't call getCroshSettings again, or update settings.
  this.mockTerminalPrivate.croshSettings = {'test': 2};
  await new Promise((resolve) => terminal.migrateSettings(resolve));
  assert.equal(callCount, 1);
  settings = await getItems();
  assert.deepEqual(settings, {'test': 1, 'crosh.settings.migrated': true});
});

});
