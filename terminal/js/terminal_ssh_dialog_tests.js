// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {TerminalSSHDialog, extractSSHDestination, parseSSHDestination,
  splitCommandLine} from './terminal_ssh_dialog.js';

describe('terminal_ssh_dialog.js', function() {
  it('splitCommandLine', function() {
    assert.deepEqual(splitCommandLine('abc'), ['abc']);
    assert.deepEqual(splitCommandLine('"abc"'), ['abc']);
    assert.deepEqual(splitCommandLine('" a b c "'), [' a b c ']);
    assert.deepEqual(splitCommandLine('abc de efg " hij   kl " mno'),
        ['abc', 'de', 'efg', ' hij   kl ', 'mno']);
  });

  it('extractSSHDestination', function() {
    const check = (argString, destination) => {
      assert.equal(extractSSHDestination(splitCommandLine(argString)),
         destination);
    };
    check('abc@localhost', 'abc@localhost');
    check('ssh://abc@localhost:123', 'ssh://abc@localhost:123');
    check('-4 abc@localhost', 'abc@localhost');
    check('abc@localhost -4', 'abc@localhost');
    check('-o xxx=yyy abc@localhost', 'abc@localhost');
    check('-oxxx=yyy abc@localhost', 'abc@localhost');
    check('-4 -o xxx=yyy abc@localhost', 'abc@localhost');
    check('-4Ao xxx=yyy abc@localhost', 'abc@localhost');
    check('-4Aoxxx=yyy abc@localhost', 'abc@localhost');

    check('-o abc@localhost', null);
    check('-4Ao abc@localhost', null);
  });

  it('parseSSHDestination', function() {
    assert.deepEqual(parseSSHDestination('abc@def'),
        {user: 'abc', hostname: 'def', port: null});
    assert.deepEqual(parseSSHDestination('ssh://abc@def'),
        {user: 'abc', hostname: 'def', port: null});
    assert.deepEqual(parseSSHDestination('ssh://abc@def:100'),
        {user: 'abc', hostname: 'def', port: 100});
  });

  describe('dialog', function() {
    beforeEach(async function() {
      this.el = /** @type {!TerminalSSHDialog} */(
          document.createElement('terminal-ssh-dialog'));
      document.body.append(this.el);
      await this.el.updateComplete;
      this.titleEl = this.el.shadowRoot.querySelector(
          '[slot="title"] terminal-textfield');
      this.commandEl = this.el.shadowRoot.querySelector('#ssh-command');
      this.relayArgsEl = this.el.relayArgsRef_.value;
      this.inputCommand = (command) => {
        this.commandEl.value = command;
        this.commandEl.dispatchEvent(new Event('input'));
      };
    });

    afterEach(function() {
      document.body.removeChild(this.el);
    });

    it('title', async function() {
      // Use default title.
      assert.equal(this.titleEl.value, 'TERMINAL_HOME_NEW_SSH_CONNECTION');

      // Title follows username@hostname
      this.inputCommand('abc@def');
      await this.el.updateComplete;
      assert.equal(this.titleEl.value, 'abc@def');

      this.inputCommand('ghi@jkl');
      await this.el.updateComplete;
      assert.equal(this.titleEl.value, 'ghi@jkl');

      // If the user override the title, we don't change it any more.
      this.titleEl.value = 'workstation';
      this.titleEl.dispatchEvent(new Event('change'));
      await this.el.updateComplete;
      assert.equal(this.titleEl.value, 'workstation');

      this.inputCommand('ghi@jkl');
      await this.el.updateComplete;
      assert.equal(this.titleEl.value, 'workstation');
    });

    it('add --config=google automatically', async function() {
      this.relayArgsEl.value = '--proxy-host=xxx';

      this.inputCommand('abc@example.com');
      await this.el.updateComplete;
      assert.equal(this.relayArgsEl.value, '--proxy-host=xxx');

      this.inputCommand('abc@xxx.corp.google.com');
      await this.el.updateComplete;
      assert.equal(this.relayArgsEl.value, '--config=google --proxy-host=xxx');
    });
  });
});
