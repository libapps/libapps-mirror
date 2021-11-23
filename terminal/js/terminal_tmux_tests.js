// Copyright 2021 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Unit tests for terminal_tmux.js.
 */

import {MockObject} from './terminal_test_mocks.js';
import {PseudoTmuxCommand} from './terminal_tmux.js';
import * as tmux from './tmux.js';

// TODO(crbug.com/1252271): add all the missing tests.

const document = window.document;

describe('terminal_tmux.js', function() {

  describe('PseudoTmuxCommand', function() {

    beforeEach(function() {
      this.mockHtermTerminal = new MockObject();
      this.mockController = new MockObject();
      this.pseudoTmuxCommand = new PseudoTmuxCommand(
          /** @type {!hterm.Terminal} */(this.mockHtermTerminal.proxy),
          /** @type {!tmux.Controller} */(this.mockController.proxy),
      );

      // Add a few shortcut functions.
      this.controllerHistory =
          (method) => this.mockController.getMethodHistory(method);
      this.controllerLastArgs =
          (method) => this.mockController.getMethodLastArgs(method);
    });

    describe('onUserInput', function() {
      [
        {name: 'ctrl-c', code: '\x03'},
        {name: 'ctrl-d', code: '\x04'},
      ].forEach(function({name, code}) {
        it(`detaches on ${name}`, function() {
          assert.equal(this.controllerHistory('detach').length, 0);
          this.pseudoTmuxCommand.onUserInput(code);
          assert.equal(this.controllerHistory('detach').length, 1);
        });
      });

      it('backspace', function() {
        this.pseudoTmuxCommand.onUserInput('hello');
        assert.equal(this.pseudoTmuxCommand.buffer_, 'hello');
        this.pseudoTmuxCommand.onUserInput('\x7f');
        assert.equal(this.pseudoTmuxCommand.buffer_, 'hell');
      });

      it('sends command on enter', function() {
        this.pseudoTmuxCommand.onUserInput('hello');
        assert.equal(this.controllerHistory('queueCommand').length, 0);

        this.pseudoTmuxCommand.onUserInput('\r');
        assert.equal(this.controllerHistory('queueCommand').length, 1);
        assert.equal(this.controllerLastArgs('queueCommand')[0], 'hello');
      });

      it('supports user input before the last command returns', function() {
        this.pseudoTmuxCommand.onUserInput('hello\r');
        assert.equal(this.controllerHistory('queueCommand').length, 1);
        assert.equal(this.controllerLastArgs('queueCommand')[0], 'hello');

        // More user input without calling the last command callback.
        this.pseudoTmuxCommand.onUserInput('world\r');
        assert.equal(this.controllerHistory('queueCommand').length, 2);
        assert.equal(this.controllerLastArgs('queueCommand')[0], 'world');
      });
    });
  });
});
