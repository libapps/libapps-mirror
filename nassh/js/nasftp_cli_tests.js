// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview nasftp tests.
 */

import {lib} from '../../libdot/index.js';

import {hterm} from '../../hterm/index.js';

import {Cli, defaultColorMap, ProgressBar} from './nasftp_cli.js';
import {CommandInstance} from './nassh_command_instance.js';
import {MockSftpClient} from './nassh_sftp_fsp_tests.js';
import {FileAttrs, StatusCodes} from './nassh_sftp_packet_types.js';
import {StatusError} from './nassh_sftp_status.js';

describe('nasftp_cli_tests.js', () => {

/**
 * A mock object for nasftp.Cli usage.
 *
 * @param {!hterm.Terminal} terminal The terminal to display to.
 * @constructor
 * @extends {CommandInstance}
 */
const MockSftpCommandInstance = function(terminal) {
  this.terminal = terminal;
  this.io = terminal.io;
  this.sftpClient = new MockSftpClient();
  this.syncStorage = new lib.Storage.Memory();
  this.exited_ = false;

  // Stub out bell ringing to avoid spamming audio and upsetting Chrome when
  // we try to play a lot of audio files all at once in the background.
  this.rang_ = 0;
  this.terminal.ringBell = () => {
    this.rang_++;
  };
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
 * A mock object for showDirectoryPicker API.
 *
 * @param {string=} name
 * @return {function(!Object=): !Promise<!FileSystemDirectoryHandle>}
 * @suppress {checkTypes} The mock is fine, but closure wants a lot of casts.
 */
function MockShowDirectoryPicker(name = 'foo') {
  return async function(options) {
    return {
      name,
    };
  };
}

/**
 * Promise wrapper for setTimeout.  Some nasftp APIs don't use promises.
 *
 * @param {number=} timeout How long (milliseconds) to wait.
 * @return {!Promise<void>} Resolve after the timeout.
 */
function sleep(timeout = 1) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

/**
 * Create a new hterm.Terminal object for testing.
 *
 * Do it once per-run for speed.
 */
before(function(done) {
  const document = globalThis.document;

  const div = document.createElement('div');
  this.div = div;
  div.style.position = 'absolute';
  div.style.height = '100%';
  div.style.width = '100%';
  document.body.appendChild(div);

  this.terminal = new hterm.Terminal({
    storage: new lib.Storage.Memory(),
  });
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
beforeEach(async function() {
  delete globalThis.showDirectoryPicker;
  this.terminal.reset();
  this.instance = new MockSftpCommandInstance(this.terminal);
  this.cli = new Cli(this.instance, {localStorage: new lib.Storage.Memory()});
  this.client = this.cli.client;
  await this.cli.run();
});

/**
 * Check random progressbar handling.
 */
it('nasftp-progressbar-random', function() {
  const spinner = new ProgressBar(this.terminal);
  spinner.update();
  spinner.update();
  spinner.update();
  spinner.finish(true);
});

/**
 * Check percent progressbar handling.
 */
it('nasftp-progressbar-percent', function() {
  const spinner = new ProgressBar(this.terminal, 10);
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
 * Check get command.
 */
it('nasftp-get-not-enough-args', async function() {
  // Missing args shouldn't trigger activity.
  this.client.fileStatus.return = (path) => {
    assert.fail();
  };
  await this.cli.dispatchCommand_('get');
  await this.cli.dispatchCommand_('reget');
});

it('nasftp-get-fetch-one-missing', async function() {
  const checked = [];
  this.client.fileStatus.return = (path) => {
    checked.push(path);
    throw new StatusError({
      'code': StatusCodes.NO_SUCH_FILE,
      'message': path,
     }, 'fileStatus');
  };
  await this.cli.dispatchCommand_('get foo');
  assert.deepStrictEqual(checked, ['./foo']);
});

it('nasftp-reget-fetch-one-missing', async function() {
  const checked = [];
  this.client.fileStatus.return = (path) => {
    checked.push(path);
    throw new StatusError({
      'code': StatusCodes.NO_SUCH_FILE,
      'message': path,
     }, 'fileStatus');
  };
  await this.cli.dispatchCommand_('reget foo');
  assert.deepStrictEqual(checked, ['./foo']);
});

it('nasftp-get-almost-fetch-one', async function() {
  // The stat passes, so we start the process, but thent he open call fails,
  // so we clean up & return.
  this.client.fileStatus.return = (path) => {
    return {
      size: 1 * 1024 * 1024,
    };
  };
  const chunks = [];
  let closed = false;
  // Enough of a stub to handle open & close.  If we want to test deeper, should
  // expand & formalize this mock a bit more.
  globalThis.showDirectoryPicker = async (options) => {
    return /** @type {!FileSystemDirectoryHandle} */ ({
      getFileHandle: async (name, options) => {
        return {
          getFile: async () => {
            return {
              size: 1024 * 1024,
            };
          },
          createWritable: async () => {
            return {
              write: async (chunk) => chunks.push(chunk),
              truncate: async (size) => {},
              close: async () => closed = true,
            };
          },
        };
      },
    });
  };
  await this.cli.dispatchCommand_('get foo');
  assert.isTrue(closed);
});

/**
 * Check help command.
 */
it('nasftp-help', function(done) {
  this.cli.dispatchCommand_('help')
    .then(() => done());
});

/**
 * Check history command.
 */
it('nasftp-history', async function() {
  assert.deepStrictEqual(this.cli.history_, []);
  assert.deepStrictEqual(this.cli.localPrefs_.get('history'), []);

  // Run a command.
  await this.cli.onInput_('prompt\n');
  assert.deepStrictEqual(this.cli.history_, ['prompt']);
  assert.deepStrictEqual(this.cli.localPrefs_.get('history'), ['prompt']);

  // Show history.
  await this.cli.onInput_('history\n');
  assert.deepStrictEqual(this.cli.history_, ['history', 'prompt']);
  assert.deepStrictEqual(
      this.cli.localPrefs_.get('history'), ['history', 'prompt']);

  // Clear history.
  await this.cli.dispatchCommand_('history -c');
  assert.deepStrictEqual(this.cli.history_, []);
  assert.deepStrictEqual(this.cli.localPrefs_.get('history'), []);

  // Make sure underlying array storage is not the same.
  this.cli.history_.push('asdf');
  assert.deepStrictEqual(this.cli.localPrefs_.get('history'), []);
});

/**
 * Check lcd command.
 */
it('nasftp-lcd', async function() {
  globalThis.showDirectoryPicker = MockShowDirectoryPicker();
  await this.cli.dispatchCommand_('lcd');
  assert.equal(this.cli.lcwd.name, 'foo');

  globalThis.showDirectoryPicker = MockShowDirectoryPicker('bar');
  await this.cli.dispatchCommand_('lchdir');
  assert.equal(this.cli.lcwd.name, 'bar');
});

it('nasftp-lcd-extra-args', async function() {
  globalThis.showDirectoryPicker = MockShowDirectoryPicker();
  await this.cli.dispatchCommand_('lcd bar');
  assert.isNull(this.cli.lcwd);
});

it('nasftp-lcd-no-fs-access-api', async function() {
  delete globalThis.showDirectoryPicker;
  await this.cli.dispatchCommand_('lcd');
  assert.isNull(this.cli.lcwd);
});

/**
 * Check llist command.
 */
it('nasftp-llist', async function() {
  this.cli.lcwd = new Map([['file', {}], ['dir', {}]]);
  await this.cli.dispatchCommand_('llist');
});

it('nasftp-llist-no-lcwd', async function() {
  assert.isNull(this.cli.lcwd);
  await this.cli.dispatchCommand_('llist');
  await this.cli.dispatchCommand_('lls');
  await this.cli.dispatchCommand_('ldir');
});

it('nasftp-llist-extra-args', async function() {
  // An invalid value to trigger crashes.
  this.cli.lcwd = 1;
  await this.cli.dispatchCommand_('llist .');
  await this.cli.dispatchCommand_('lls .');
  await this.cli.dispatchCommand_('ldir .');
});

/**
 * Check lpwd command.
 */
it('nasftp-lpwd', async function() {
  assert.isNull(this.cli.lcwd);
  await this.cli.dispatchCommand_('lpwd');
  this.cli.lcwd = 'foo';
  await this.cli.dispatchCommand_('lpwd');
});

/**
 * Check mget command.
 */
it('nasftp-mget-not-enough-args', async function() {
  // Missing args shouldn't trigger activity.
  this.client.fileStatus.return = (path) => {
    assert.fail();
  };
  await this.cli.dispatchCommand_('mget');
  await this.cli.dispatchCommand_('mreget');
});

it('nasftp-mget-fetch-many-missing', async function() {
  const checked = [];
  this.client.fileStatus.return = (path) => {
    checked.push(path);
    throw new StatusError({
      'code': StatusCodes.NO_SUCH_FILE,
      'message': path,
     }, 'fileStatus');
  };
  await this.cli.dispatchCommand_('mget a b c');
  assert.deepStrictEqual(checked, ['./a', './b', './c']);
});

it('nasftp-mreget-fetch-many', async function() {
  const checked = [];
  this.client.fileStatus.return = (path) => {
    checked.push(path);
    throw new StatusError({
      'code': StatusCodes.NO_SUCH_FILE,
      'message': path,
     }, 'fileStatus');
  };
  await this.cli.dispatchCommand_('mreget a b c');
  assert.deepStrictEqual(checked, ['./a', './b', './c']);
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
it('nasftp-prompt', async function() {
  assert.isNull(this.cli.prompt_);
  assert.isNull(this.cli.prefs_.get('prompt'));

  // Toggle the prompt (to get color).
  await this.cli.dispatchCommand_('prompt');
  assert.strictEqual(this.cli.prompt_, '');
  assert.strictEqual(this.cli.prefs_.get('prompt'), '');

  // Set the prompt.
  await this.cli.dispatchCommand_('prompt "$ > "');
  assert.strictEqual(this.cli.prompt_, '$ > ');
  assert.strictEqual(this.cli.prefs_.get('prompt'), '$ > ');

  // Clear the prompt.
  await this.cli.dispatchCommand_('prompt');
  assert.isNull(this.cli.prompt_);
  assert.isNull(this.cli.prefs_.get('prompt'));
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
  result = this.cli.completeCommand_('he');
  assert.deepStrictEqual({arg: 'he', matches: ['help']}, result);

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
 * Helper to mock remote path completion.
 *
 * @param {!Array<!FileAttrs>=} entries The remote paths.  If none are
 *     specified, a default set will be used.
 * @this {Cli}
 */
function mockCompleteRemotePath(entries = undefined) {
  if (entries === undefined) {
    entries = [
      {filename: '.', isDirectory: true},
      {filename: '..', isDirectory: true},
      {filename: '.git', isDirectory: true},
      {filename: '.vimrc', isDirectory: false},
      {filename: 'boot', isDirectory: true},
      {filename: 'etc', isDirectory: true},
      {filename: 'fsck', isDirectory: false},
      {filename: 'proc', isDirectory: true},
      {filename: 'sys', isDirectory: true},
    ];
  }

  this.client.openDirectory.return = (path) => {
    return 'handle';
  };
  this.client.scanDirectory.return = async (handle, callback) => {
    assert.equal('handle', handle);
    const filtered = [];
    for (let i = 0; i < entries.length; ++i) {
      const entry = entries[i];
      if (await callback(entry)) {
        filtered.push(entry);
      }
    }
    return filtered;
  };
  this.client.closeFile.return = (handle) => {
    assert.equal('handle', handle);
  };
}

/**
 * Check command buffer completion.
 */
describe('nasftp-complete-input', () => {
  const data = [
    // Command completion matches nothing.
    ['asdf', {arg: 'asdf', matches: []}],

    // Unknown command matches nothing.
    ['asdf -', {arg: 'asdf', matches: []}],

    // Stop completing options.
    ['ls -- -', {arg: '-', matches: [], colorize: {}, skip: 0}],
    // But still complete paths.
    ['ls -- ', {
      arg: '',
      matches: ['Desktop/', 'test.c', 'Videos/'],
      colorize: {
        'Desktop/': defaultColorMap['dir'],
        'Videos/': defaultColorMap['dir'],
        'test.c': null,
      },
      skip: 0,
    }],

    // Complete known commands.
    ['hel', {arg: 'hel', matches: ['help']}],

    // Complete known command options.
    ['truncate -', {arg: '-', matches: ['-s']}],

    // Complete known command arguments.
    ['help lis', {arg: 'lis', matches: ['list']}],
    ['help list realp', {arg: 'realp', matches: ['realpath']}],
  ];

  const entries = [
    {filename: '.', isDirectory: true},
    {filename: '..', isDirectory: true},
    {filename: 'Desktop', isDirectory: true},
    {filename: 'test.c', isDirectory: false},
    {filename: 'Videos', isDirectory: true},
  ];

  for (let i = 0; i < data.length; ++i) {
    const [input, exp] = data[i];
    it(input, async function() {
      mockCompleteRemotePath.call(this, entries);
      const result = await this.cli.completeInputBuffer_(input);
      assert.deepStrictEqual(result, exp);
    });
  }
});

/**
 * Check remote path completion.
 */
it('nasftp-complete-remote-paths', async function() {
  mockCompleteRemotePath.call(this);

  const tests = [
    ['/', ['/boot/', '/etc/', '/fsck', '/proc/', '/sys/']],
    ['/b', ['boot/']],
    ['.', ['./', '../', '.git/', '.vimrc']],
    ['../.', ['./', '../', '.git/', '.vimrc']],
  ];
  for (let i = 0; i < tests.length; ++i) {
    const [arg, exp] = tests[i];
    const result = await this.cli.completeRemotePath_(arg);
    assert.deepStrictEqual(result.matches, exp);
  }
});

/**
 * Check subcommands that don't offer.
 */
describe('nasftp-no-complete-commands', () => {
  const commands = [
    'lcd',
    'lchdir',
    'ldir',
    'llist',
    'lls',
    'lpwd',
    'mput',
    'mreput',
  ];
  for (const command of commands) {
    it(command, async function() {
      mockCompleteRemotePath.call(this);
      this.cli.stdin_ = `${command} b`;
      this.cli.onTabKey_();
      await sleep();
      assert.equal(this.cli.stdin_, `${command} b`);
    });
  }
});

/**
 * Helper for running subcommand completions.
 *
 * @param {!Array<!Array<string>>} tests The tests to run.
 */
function completeCommandTests(tests) {
  for (let i = 0; i < tests.length; ++i) {
    const [input, exp] = tests[i];
    it(input, async function() {
      mockCompleteRemotePath.call(this);
      this.cli.stdin_ = input;
      this.cli.onTabKey_();
      await sleep();
      assert.equal(this.cli.stdin_, exp);
    });
  }
}

/**
 * Check cat subcommand completion.
 */
describe('nasftp-complete-cat-command', () => {
  completeCommandTests([
    // Complete the first arg.
    ['cat b', 'cat boot/'],
    // Don't complete the 2nd arg.
    ['cat b 1', 'cat b 1'],
  ]);
});

/**
 * Check cd subcommand completion.
 */
describe('nasftp-complete-cd-command', async function() {
  completeCommandTests([
    // Complete the first arg if it's a dir.
    ['cd b', 'cd boot/'],
    // Don't complete the first arg if it's a file.
    ['cd .vim', 'cd .vim'],
    // Complete . paths.
    ['cd .g', 'cd .git/'],
    ['cd ..', 'cd ../'],
    ['cd ../..', 'cd ../../'],
    // Don't complete multiple args.
    ['cd boot/ b', 'cd boot/ b'],
  ]);
});

/**
 * Check chmod subcommand completion.
 */
describe('nasftp-complete-chmod-command', async function() {
  completeCommandTests([
    // Don't complete the mode.
    ['chmod 7', 'chmod 7'],
/*
    // Complete the remaining directory args.
    ['chmod 755 b', 'chmod 755 boot/'],
    ['chmod 755 b b', 'chmod 755 b boot/'],
    ['chmod 755 b b b', 'chmod 755 b b boot/'],
    // Complete files -- should auto include a trailing space.
    ['chmod 644 .vim', 'chmod 644 .vimrc '],
*/
  ]);
});

/**
 * Check chown subcommand completion.
 *
 * This also covers chgrp since they're aliases to each other.
 */
describe('nasftp-complete-chown-chgrp-command', async function() {
  completeCommandTests([
    // Don't complete the mode.
    ['chown b', 'chown b'],
    // Complete the remaining directory args.
    ['chown user b', 'chown user boot/'],
    ['chown user b b', 'chown user b boot/'],
    ['chown user b b b', 'chown user b b boot/'],
    // Complete files -- should auto include a trailing space.
    ['chgrp user .vim', 'chgrp user .vimrc '],
  ]);
});

/**
 * Check clip subcommand completion.
 */
describe('nasftp-complete-clip-command', async function() {
  completeCommandTests([
    // Complete the first path arg.
    ['clip s', 'clip sys/'],
    // Don't complete remaining args.
    ['clip sys/ s', 'clip sys/ s'],
    ['clip sys/ 1', 'clip sys/ 1'],
    ['clip sys/ s s', 'clip sys/ s s'],
    // Complete files -- should auto include a trailing space.
    ['clip .vim', 'clip .vimrc '],
  ]);
});

/**
 * Check copy subcommand completion.
 */
describe('nasftp-complete-copy-command', async function() {
  completeCommandTests([
    // Complete the first path arg.
    ['cp s', 'cp sys/'],
    // Complete the 2nd path arg.
    ['cp sys/ s', 'cp sys/ sys/'],
    // Don't complete remaining args.
    ['cp sys/ s s', 'cp sys/ s s'],
    // Complete files -- should auto include a trailing space.
    ['cp .vim', 'cp .vimrc '],
  ]);
});

/**
 * Check df subcommand completion.
 */
describe('nasftp-complete-df-command', async function() {
  completeCommandTests([
    // Complete all args as paths.
    ['df s', 'df sys/'],
    ['df s s', 'df s sys/'],
    ['df s s s', 'df s s sys/'],
    // Complete files -- should auto include a trailing space.
    ['df .vim', 'df .vimrc '],
  ]);
});

/**
 * Check get subcommand completion.
 */
describe('nasftp-complete-get-command', async function() {
  completeCommandTests([
    // Complete the first path arg.
    ['get s', 'get sys/'],
    // Don't complete remaining args.
    ['get sys/ s', 'get sys/ s'],
    ['get sys/ 1', 'get sys/ 1'],
    ['get sys/ s s', 'get sys/ s s'],
    // Complete files -- should auto include a trailing space.
    ['get .vim', 'get .vimrc '],
  ]);
});

/**
 * Check list subcommand completion.
 */
describe('nasftp-complete-ls-command', async function() {
  completeCommandTests([
    // Complete all args as paths.
    ['ls s', 'ls sys/'],
    ['ls s s', 'ls s sys/'],
    ['ls s s s', 'ls s s sys/'],
    // Complete files -- should auto include a trailing space.
    ['ls .vim', 'ls .vimrc '],
  ]);
});

/**
 * Check ln subcommand completion.
 */
describe('nasftp-complete-ln-command', async function() {
  completeCommandTests([
    // Complete the first path arg.
    ['ln s', 'ln sys/'],
    // Complete the 2nd path arg.
    ['ln sys/ s', 'ln sys/ sys/'],
    // Don't complete remaining args.
    ['ln sys/ s s', 'ln sys/ s s'],
    // Complete files -- should auto include a trailing space.
    ['ln .vim', 'ln .vimrc '],
  ]);
});

/**
 * Check mkdir subcommand completion.
 */
describe('nasftp-complete-mkdir-command', async function() {
  completeCommandTests([
    // Complete all args as dirs.
    ['mkdir s', 'mkdir sys/'],
    ['mkdir s s', 'mkdir s sys/'],
    ['mkdir s s s', 'mkdir s s sys/'],
    // Do not complete files -- can't mkdir them.
    ['mkdir .vim', 'mkdir .vim'],
  ]);
});

/**
 * Check get subcommand completion.
 */
describe('nasftp-complete-mget-command', async function() {
  completeCommandTests([
    // Complete all args as remote paths.
    ['mget s', 'mget sys/'],
    ['mget sys/ s', 'mget sys/ sys/'],
    ['mget sys/ 1', 'mget sys/ 1'],
    ['mget sys/ s s', 'mget sys/ s sys/'],
    // Complete files -- should auto include a trailing space.
    ['mget .vim', 'mget .vimrc '],
  ]);
});

/**
 * Check get subcommand completion.
 */
describe('nasftp-complete-mreget-command', async function() {
  completeCommandTests([
    // Complete all args as remote paths.
    ['mreget s', 'mreget sys/'],
    ['mreget sys/ s', 'mreget sys/ sys/'],
    ['mreget sys/ 1', 'mreget sys/ 1'],
    ['mreget sys/ s s', 'mreget sys/ s sys/'],
    // Complete files -- should auto include a trailing space.
    ['mreget .vim', 'mreget .vimrc '],
  ]);
});

/**
 * Check move subcommand completion.
 */
describe('nasftp-complete-mv-command', async function() {
  completeCommandTests([
    // Complete the first path arg.
    ['mv s', 'mv sys/'],
    // Complete the 2nd path arg.
    ['mv sys/ s', 'mv sys/ sys/'],
    // Don't complete remaining args.
    ['mv sys/ s s', 'mv sys/ s s'],
    // Complete files -- should auto include a trailing space.
    ['mv .vim', 'mv .vimrc '],
  ]);
});

/**
 * Check put subcommand completion.
 */
describe('nasftp-complete-put-command', async function() {
  completeCommandTests([
    // Complete the first path arg.
    ['put s', 'put sys/'],
    // Don't complete remaining args.
    ['put sys/ s', 'put sys/ s'],
    ['put sys/ 1', 'put sys/ 1'],
    ['put sys/ s s', 'put sys/ s s'],
    // Complete files -- should auto include a trailing space.
    ['put .vim', 'put .vimrc '],
  ]);
});

/**
 * Check readlink subcommand completion.
 */
describe('nasftp-complete-readlink-command', async function() {
  completeCommandTests([
    // Complete all args as paths.
    ['readlink s', 'readlink sys/'],
    ['readlink s s', 'readlink s sys/'],
    ['readlink s s s', 'readlink s s sys/'],
    // Complete files -- should auto include a trailing space.
    ['readlink .vim', 'readlink .vimrc '],
  ]);
});

/**
 * Check realpath subcommand completion.
 */
describe('nasftp-complete-realpath-command', async function() {
  completeCommandTests([
    // Complete all args as paths.
    ['realpath s', 'realpath sys/'],
    ['realpath s s', 'realpath s sys/'],
    ['realpath s s s', 'realpath s s sys/'],
    // Complete files -- should auto include a trailing space.
    ['realpath .vim', 'realpath .vimrc '],
  ]);
});

/**
 * Check remove subcommand completion.
 */
describe('nasftp-complete-rm-command', async function() {
  completeCommandTests([
    // Complete all args as paths.
    ['rm s', 'rm sys/'],
    ['rm s s', 'rm s sys/'],
    ['rm s s s', 'rm s s sys/'],
    // Complete files -- should auto include a trailing space.
    ['rm .vim', 'rm .vimrc '],
  ]);
});

/**
 * Check rmdir subcommand completion.
 */
describe('nasftp-complete-rmdir-command', async function() {
  completeCommandTests([
    // Complete all args as dirs.
    ['rmdir s', 'rmdir sys/'],
    ['rmdir s s', 'rmdir s sys/'],
    ['rmdir s s s', 'rmdir s s sys/'],
    // Do not complete files -- can't rmdir them.
    ['rmdir .vim', 'rmdir .vim'],
  ]);
});

/**
 * Check show subcommand completion.
 */
describe('nasftp-complete-show-command', async function() {
  completeCommandTests([
    // Complete all args as paths.
    ['show s', 'show sys/'],
    ['show s s', 'show s sys/'],
    ['show s s s', 'show s s sys/'],
    // Complete files -- should auto include a trailing space.
    ['show .vim', 'show .vimrc '],
  ]);
});

/**
 * Check stat subcommand completion.
 */
describe('nasftp-complete-stat-command', async function() {
  completeCommandTests([
    // Complete all args as paths.
    ['stat s', 'stat sys/'],
    ['stat s s', 'stat s sys/'],
    ['stat s s s', 'stat s s sys/'],
    // Complete files -- should auto include a trailing space.
    ['stat .vim', 'stat .vimrc '],
  ]);
});

/**
 * Check truncate subcommand completion.
 */
describe('nasftp-complete-truncate-command', async function() {
  completeCommandTests([
    // Complete all args as paths.
    ['truncate s', 'truncate sys/'],
    ['truncate s s', 'truncate s sys/'],
    ['truncate s s s', 'truncate s s sys/'],
    // Complete files -- should auto include a trailing space.
    ['truncate .vim', 'truncate .vimrc '],
  ]);
});

/**
 * Check symlink subcommand completion.
 */
describe('nasftp-complete-symlink-command', async function() {
  completeCommandTests([
    // Complete the first path arg.
    ['symlink s', 'symlink sys/'],
    // Complete the 2nd path arg.
    ['symlink sys/ s', 'symlink sys/ sys/'],
    // Don't complete remaining args.
    ['symlink sys/ s s', 'symlink sys/ s s'],
    // Complete files -- should auto include a trailing space.
    ['symlink .vim', 'symlink .vimrc '],
  ]);
});

});
