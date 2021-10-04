// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview nasftp tests.
 */

describe('nasftp_cli_tests.js', () => {

/**
 * A mock object for nasftp.Cli usage.
 *
 * @param {!hterm.Terminal} terminal The terminal to display to.
 * @constructor
 * @extends {nassh.CommandInstance}
 */
const MockSftpCommandInstance = function(terminal) {
  this.terminal = terminal;
  this.io = terminal.io;
  this.sftpClient = new MockSftpClient();
  this.exited_ = false;
};

/**
 * Mock for the exit method.
 *
 * @override
 */
MockSftpCommandInstance.prototype.exit = function() {
  this.exited_ = true;
};

/**
 * Create a new hterm.Terminal object for testing.
 *
 * Do it once per-run for speed.
 */
before(function(done) {
  const document = window.document;

  const div = document.createElement('div');
  this.div = div;
  div.style.position = 'absolute';
  div.style.height = '100%';
  div.style.width = '100%';
  document.body.appendChild(div);

  this.terminal = new hterm.Terminal();
  this.terminal.decorate(div);
  // The terminal doesn't need to be super big.
  this.terminal.setHeight(5);
  this.terminal.setWidth(80);
  this.terminal.onTerminalReady = () => {
    done();
  };
});

/**
 * Clean up the terminal state.
 */
after(function() {
  document.body.removeChild(this.div);
});

/**
 * Create a new sftp cli instance for testing.
 *
 * Reset the terminal back to a good state before each run.
 */
beforeEach(function() {
  this.terminal.reset();
  this.instance = new MockSftpCommandInstance(this.terminal);
  this.cli = new nasftp.Cli(this.instance);
  this.client = this.cli.client;
});

/**
 * Check random progressbar handling.
 */
it('nasftp-progressbar-random', function() {
  const spinner = new nasftp.ProgressBar(this.terminal);
  spinner.update();
  spinner.update();
  spinner.update();
  spinner.finish(true);
});

/**
 * Check percent progressbar handling.
 */
it('nasftp-progressbar-percent', function() {
  const spinner = new nasftp.ProgressBar(this.terminal, 10);
  spinner.update(1);
  spinner.update(5);
  spinner.update(9);
  spinner.finish();
  spinner.summarize();
});

/**
 * Check escape string handling.
 */
it('nasftp-escape-string', function() {
  assert.equal('␀␁abc␍\t␡', this.cli.escapeString_('\x00\x01abc\r\t\x7f'));
});

/**
 * Check number parsing.
 */
describe('parseint', () => {
  const data = [
    // Bad inputs.
    ['', null],
    ['z', null],

    // Good decimal inputs.
    ['0', 0],
    ['10', 10],
    ['0x0', 0],

    // Good hex inputs.
    ['0xf', 15],
    ['0xF', 15],

    // Decimal inputs with units.
    ['0K', 0],
    ['1K', 1024],
    ['1KiB', 1024],
    ['1KB', 1000],
    ['4M', 4194304],
    ['5MiB', 5242880],
    ['5MB', 5000000],
    ['123G', 132070244352],
    ['100GiB', 107374182400],
    ['9999GB', 9999000000000],

    // Hex inputs with units.
    ['0x0K', 0],
    ['0x10K', 16 * 1024],
    ['0x10KiB', 16 * 1024],
    ['0x10KB', 16000],
    ['0x10000MiB', 68719476736],
  ];

  data.forEach(([input, exp]) => {
    it(`"${input}" -> ${exp}`, function() {
      assert.equal(this.cli.parseInt_('cmd', 'foo', input), exp);
    });
  });
});

/**
 * Check basic input processing.
 */
it('nasftp-input-empty', function(done) {
  this.cli.onInput_('\n')
    .then(() => done());
});

/**
 * Check unknown command handling.
 */
it('nasftp-unknown-string', function(done) {
  this.cli.dispatchCommand_('alsdjfads')
    .catch(() => done());
});

/**
 * Check unknown command handling with a list.
 */
it('nasftp-unknown-argv', function(done) {
  this.cli.dispatchCommand_(['alsdjfads'])
    .catch(() => done());
});

/**
 * Check known command with too few arguments.
 */
it('nasftp-too-few-args', function(done) {
  this.client.symLink.return = () => assert.fail();

  this.cli.dispatchCommand_('symlink 1')
    .then(() => done());
});

/**
 * Check known command with too many arguments.
 */
it('nasftp-too-many-args', function(done) {
  this.client.symLink.return = () => assert.fail();

  this.cli.dispatchCommand_('symlink 1 2 3')
    .then(() => done());
});

/**
 * Check cd command.
 */
it('nasftp-cd', function(done) {
  this.client.realPath.return = (path) => {
    assert.equal('/foo', path);
    return {files: [{filename: '/bar'}]};
  };

  this.client.fileStatus.return = (path) => {
    assert.equal('/bar/', path);
    this.client.cwd = 'yes';
  };

  this.cli.dispatchCommand_('cd /foo')
    .then(() => {
      assert.equal('yes', this.client.cwd);
      done();
    });
});

/**
 * Check clear command.
 */
it('nasftp-clear', function(done) {
  this.cli.dispatchCommand_('clear')
    .then(() => done());
});

/**
 * Check color command.
 */
it('nasftp-color', function(done) {
  this.cli.dispatchCommand_('color')
    .then(() => done());
});

/**
 * Check help command.
 */
it('nasftp-help', function(done) {
  this.cli.dispatchCommand_('help')
    .then(() => done());
});

/**
 * Check mkdir command.
 */
it('nasftp-mkdir', function(done) {
  const args = ['./a', './b', './c'];
  this.client.makeDirectory.return = (path) => {
    assert.equal(args.shift(), path);
  };

  this.cli.dispatchCommand_('mkdir a b c')
    .then(() => {
      assert.deepStrictEqual([], args);
      done();
    });
});

/**
 * Check move command.
 */
it('nasftp-move', function(done) {
  const args = ['./a', './b'];
  this.client.renameFile.return = (source, target) => {
    assert.equal(args.shift(), source);
    assert.equal(args.shift(), target);
  };

  this.cli.dispatchCommand_('mv a b')
    .then(() => {
      assert.deepStrictEqual([], args);
      done();
    });
});

/**
 * Check prompt command.
 */
it('nasftp-prompt', function(done) {
  this.cli.dispatchCommand_('prompt')
    .then(() => done());
});

/**
 * Check pwd command.
 */
it('nasftp-pwd', function(done) {
  this.cli.dispatchCommand_('pwd')
    .then(() => done());
});

/**
 * Check quit command.
 */
it('nasftp-quit', function(done) {
  this.cli.dispatchCommand_('quit')
    .then(() => {
      assert.equal(true, this.instance.exited_);
      done();
    });
});

/**
 * Check readlink command.
 */
it('nasftp-readlink', function(done) {
  const args = ['./a', './b', './c'];
  this.client.readLink.return = (path) => {
    const exp = args.shift();
    assert.equal(exp, path);
    return {files: [{filename: path}]};
  };

  this.cli.dispatchCommand_('readlink a b c')
    .then(() => {
      assert.deepStrictEqual([], args);
      done();
    });
});

/**
 * Check realpath command.
 */
it('nasftp-realpath', function(done) {
  const args = ['./a', './b', './c'];
  this.client.realPath.return = (path) => {
    const exp = args.shift();
    assert.equal(exp, path);
    return {files: [{filename: path}]};
  };

  this.cli.dispatchCommand_('realpath a b c')
    .then(() => {
      assert.deepStrictEqual([], args);
      done();
    });
});

/**
 * Check rmdir command.
 */
it('nasftp-rmdir', function(done) {
  const args = ['./a', './b', './c'];
  this.client.removeDirectory.return = (path) => {
    assert.equal(args.shift(), path);
  };

  this.cli.dispatchCommand_('rmdir a b c')
    .then(() => {
      assert.deepStrictEqual([], args);
      done();
    });
});

/**
 * Check symlink command.
 */
it('nasftp-symlink', function(done) {
  const args = ['./a', './b'];
  this.client.symLink.return = (target, path) => {
    assert.equal(args.shift(), target);
    assert.equal(args.shift(), path);
  };

  this.cli.dispatchCommand_('symlink a b')
    .then(() => {
      assert.deepStrictEqual([], args);
      done();
    });
});

/**
 * Check version command.
 */
it('nasftp-version', function(done) {
  this.cli.dispatchCommand_('version')
    .then(() => done());
});

/**
 * Check command name completion.
 */
it('nasftp-complete-command', function() {
  // Match everything.
  let result = this.cli.completeCommand_('');
  assert.deepStrictEqual(result.arg, '');
  assert.include(result.matches, 'bye');

  // Match one command with one char.
  result = this.cli.completeCommand_('h');
  assert.deepStrictEqual({arg: 'h', matches: ['help']}, result);

  // Match multiple commands with two chars.
  result = this.cli.completeCommand_('re');
  assert.deepStrictEqual(result.arg, 're');
  assert.include(result.matches, 'readlink');
  assert.include(result.matches, 'realpath');
  assert.include(result.matches, 'reput');

  // Match complete command.
  result = this.cli.completeCommand_('move');
  assert.deepStrictEqual({arg: 'move', matches: ['move']}, result);
});

/**
 * Check option completion.
 */
it('nasftp-complete-options', function() {
  const data = [
    // Match nothing due to missing - prefix.
    ['abLvZ', [''], null],

    // Halt matching due to seeing non-option argument.
    ['asdf', ['-f', 'foo', '-'], null],

    // Halt matching due to seeing -- marker.
    ['asdf', ['-f', '--', '-'], null],

    // Match everything.
    ['abLvZ', ['-'], ['-L', '-Z', '-a', '-b', '-v']],
    ['abLvZ', ['-x', '-'], ['-L', '-Z', '-a', '-b', '-v']],

    // Match remaining.
    ['abLvZ', ['-v'], ['-L', '-Z', '-a', '-b']],
    ['abLvZ', ['-Zv'], ['-L', '-a', '-b']],
    ['abLvZ', ['-Z', '-v'], ['-L', '-a', '-b']],
  ];

  data.forEach(([opts, args, matches]) => {
    args.unshift('cmd');
    const result = this.cli.completeCommandOptions_(args, opts);

    if (!matches) {
      assert.isNull(result);
    } else {
      assert.deepStrictEqual(result.matches, matches);
    }
  });
});

/**
 * Check command buffer completion.
 */
describe('nasftp-complete-input', () => {
  const data = [
    // Command completion matches nothing.
    ['asdf', {arg: 'asdf', matches: []}],

    // Unknown command matches nothing.
    ['asdf -', {arg: 'asdf', matches: []}],

    // Stop completing.
    ['ls -- -', {arg: 'ls -- -', matches: []}],
    ['ls -- ', {arg: 'ls -- ', matches: []}],

    // Complete known commands.
    ['hel', {arg: 'hel', matches: ['help']}],

    // Complete known command options.
    ['truncate -', {arg: '-', matches: ['-s']}],

    // Complete known command arguments.
    ['help lis', {arg: 'lis', matches: ['list']}],
    ['help list realp', {arg: 'realp', matches: ['realpath']}],
  ];

  for (let i = 0; i < data.length; ++i) {
    const [input, exp] = data[i];
    it(input, async function() {
      const result = await this.cli.completeInputBuffer_(input);
      assert.deepStrictEqual(result, exp);
    });
  }
});

});
