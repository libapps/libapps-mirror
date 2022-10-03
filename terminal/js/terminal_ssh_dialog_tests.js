// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from './deps_local.concat.js';

import {TerminalSSHDialog, parseCommand, parseSSHDestination}
    from './terminal_ssh_dialog.js';

describe('terminal_ssh_dialog.js', function() {
  it('parseCommand', function() {
    const check = (argString, expectation) => {
      assert.deepEqual(parseCommand(argString), expectation);
    };
    check('abc@localhost', {
      destination: 'abc@localhost',
      argstr: '',
    });
    check('ssh://abc@localhost:123', {
      destination: 'ssh://abc@localhost:123',
      argstr: '',
    });
    check('-4 abc@localhost', {
      destination: 'abc@localhost',
      argstr: '-4',
    });
    check('abc@localhost -4', {
      destination: 'abc@localhost',
      argstr: '-4',
    });
    check('-o xxx=yyy abc@localhost', {
      destination: 'abc@localhost',
      argstr: '-o xxx=yyy',
    });
    check('-oxxx=yyy abc@localhost', {
      destination: 'abc@localhost',
      argstr: '-oxxx=yyy',
    });
    check('-4 -o xxx=yyy abc@localhost', {
      destination: 'abc@localhost',
      argstr: '-4 -o xxx=yyy',
    });
    check('-4Ao xxx=yyy abc@localhost', {
      destination: 'abc@localhost',
      argstr: '-4Ao xxx=yyy',
    });
    check('-4Aoxxx=yyy abc@localhost', {
      destination: 'abc@localhost',
      argstr: '-4Aoxxx=yyy',
    });
    check('-4Ao xxx=yyy abc@localhost -o zzz=yyy', {
      destination: 'abc@localhost',
      argstr: '-4Ao xxx=yyy  -o zzz=yyy',
    });

    // Username with special characters
    check('-4Ao xxx=yyy "abc@a b c@localhost" -o zzz=yyy', {
      destination: 'abc@a b c@localhost',
      argstr: '-4Ao xxx=yyy  -o zzz=yyy',
    });

    check('-o abc@localhost', {
      destination: null,
      argstr: '-o abc@localhost',
    });
    check('-4Ao abc@localhost', {
      destination: null,
      argstr: '-4Ao abc@localhost',
    });
  });

  it('parseSSHDestination', function() {
    assert.deepEqual(parseSSHDestination('abc@def'),
        {username: 'abc', hostname: 'def', port: null});
    assert.deepEqual(parseSSHDestination('ssh://abc@def'),
        {username: 'abc', hostname: 'def', port: null});
    assert.deepEqual(parseSSHDestination('ssh://abc@def:100'),
        {username: 'abc', hostname: 'def', port: 100});

    // With exotic usernames.
    assert.deepEqual(parseSSHDestination('abc@a b c@def'),
        {username: 'abc@a b c', hostname: 'def', port: null});
    assert.deepEqual(parseSSHDestination('ssh://abc@a b c@def:100'),
        {username: 'abc@a b c', hostname: 'def', port: 100});
  });

  describe('dialog', function() {
    beforeEach(async function() {
      window.storage = new lib.Storage.Memory();
      this.el = /** @type {!TerminalSSHDialog} */(
          document.createElement('terminal-ssh-dialog'));
      document.body.append(this.el);
      await this.el.updateComplete;
      this.titleEl = this.el.shadowRoot.querySelector(
          '[slot="title"] terminal-textfield');
      this.commandEl = this.el.commandRef_.value;
      this.relayArgsEl = this.el.relayArgsRef_.value;
      this.inputCommand = (command) => {
        this.commandEl.value = command;
        this.commandEl.dispatchEvent(new Event('input'));
      };
    });

    afterEach(function() {
      document.body.removeChild(this.el);
      delete window.storage;
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

    it('closes-on-enter-key', async function() {
      await this.el.dialogRef_.value.show();
      assert.isTrue(this.el.dialogRef_.value.open);
      this.inputCommand('user@hostname');
      await this.el.updateComplete;
      await new Promise((resolve) => {
        this.el.commandRef_.value.dispatchEvent(
            new KeyboardEvent('keydown', {key: 'Enter'}));
        this.el.addEventListener('close', resolve);
      });
      assert.isFalse(this.el.dialogRef_.value.open);
    });
  });
});
