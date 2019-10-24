// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

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

/**
 *  init.
 */
it('opens-process-in-init', async function() {
  terminal.init();
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
  const term = terminal.init();
  await this.mockTerminalPrivateController.on('openTerminalProcess');
  term.command.exit = () => { exitCalled = true; };

  await this.mockTerminalPrivate.onProcessOutput.dispatch(pid, 'exit', 'text');
  assert.isFalse(exitCalled);
  await this.mockTerminalPrivate.onProcessOutput.dispatch(pid, 'exit', 'text');
  assert.isTrue(exitCalled);
});

});
