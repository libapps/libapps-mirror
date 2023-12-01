// Copyright 2018 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This file manages the command line sftp client logic.  Not to
 *                be confused with the sftpClient class which provides a JS API
 *                only.
 */

import {lib} from '../../libdot/index.js';

import {hterm} from '../../hterm/index.js';

import {localize, sgrSequence} from './nassh.js';
import {CommandInstance, splitCommandLine} from './nassh_command_instance.js';
import {storageQuotasAreHigh} from './nassh_preference_manager.js';
import {Client as sftpClient} from './nassh_sftp_client.js';
import {SftpFsp} from './nassh_sftp_fsp.js';
import {
  bitsToUnixModeLine, epochToLocal, File, FileAttrs, FileXferAttrs, OpenFlags,
  StatusCodes,
} from './nassh_sftp_packet_types.js';
import {StatusError} from './nassh_sftp_status.js';

/**
 * Progress bar helper.
 *
 * @param {!hterm.Terminal} terminal The terminal to display to.
 * @param {number=} max The highest byte count we expect.
 * @constructor
 */
export function ProgressBar(terminal, max) {
  this.terminal_ = terminal;
  this.io_ = terminal.io;

  this.startTime_ = performance.now();
  this.endTime_ = this.startTime_;
  this.lastUpdate_ = this.startTime_;

  if (max === undefined) {
    this.mode_ = this.RANDOM;
    // Unicode 6-dot block range.
    this.min_ = 0x2801;
    this.max_ = 0x283F;
    this.pos_ = this.min_;
  } else {
    this.mode_ = this.PERCENTAGE;
    this.min_ = 0;
    this.max_ = max;
    this.pos_ = 0;
  }
  this.maxFormat_ = Cli.format_(this.max_);
}

/**
 * Progress is tracked as a random spinner.
 */
ProgressBar.prototype.RANDOM = Symbol('Random');

/**
 * Progress is tracked as a percentage output.
 */
ProgressBar.prototype.PERCENTAGE = Symbol('Percentage');

/**
 * Display the next step in the progress bar.
 *
 * @param {number=} pos The new byte count.
 */
ProgressBar.prototype.update = function(pos = 0) {
  const now = performance.now();

  if (this.mode_ == this.RANDOM) {
    this.io_.print(`${String.fromCodePoint(this.pos_)}\r`);
    // Pick a new random code point.
    this.pos_ =
        Math.floor(Math.random() * (this.max_ - this.min_ + 1)) + this.min_;
  } else {
    // Rate limit how often we update.  Updating too often can slow us down.
    // 250ms seems to be a decent balance between user feedback and not being
    // too much slower.
    if (now - this.lastUpdate_ < 250) {
      return;
    }

    const percent = Math.round(pos / this.max_ * 100);
    this.pos_ = pos;
    this.io_.print(`\r${pos} / ${this.maxFormat_} (${percent}%)`);
  }

  this.lastUpdate_ = now;
};

/**
 * Cleans up the progress bar output.
 *
 * @param {boolean=} summarize Whether to display a statistics summary.
 */
ProgressBar.prototype.finish = function(summarize = false) {
  this.endTime_ = performance.now();
  this.terminal_.eraseLine();
  this.terminal_.setCursorColumn(0);

  if (summarize) {
    this.summarize();
  }
};

/**
 * Display final transfer statistics.
 *
 * @param {number=} max The final byte count.
 */
ProgressBar.prototype.summarize = function(max) {
  if (max === undefined) {
    max = this.max_;
  }
  const delta = this.endTime_ - this.startTime_;
  const secs = Math.round(delta) / 1000;
  const rate = Math.round(max / delta * 1000);
  this.io_.println(localize(
      'NASFTP_PROGRESS_SUMMARY', [max, secs, Cli.format_(rate)]));
};

/**
 * Global nasftp preferences.
 *
 * These are synced between devices.
 */
export class PreferenceManager extends lib.PreferenceManager {
  /**
   * @param {!lib.Storage} storage
   */
  constructor(storage) {
    super(storage, '/nasftp/', {
      // Condense only if underlying storage has quota limits.
      finegrain: storageQuotasAreHigh(storage),
    });

    this.definePreferences([
      /**
       * The shell prompt.
       */
      ['prompt', null],

      /**
       * Whether to use colors.
       */
      ['color', true],
    ]);
  }
}

/**
 * Global nasftp preferences.
 *
 * These are not synced between devices.
 */
export class LocalPreferenceManager extends lib.PreferenceManager {
  /**
   * @param {!lib.Storage} storage
   */
  constructor(storage) {
    super(storage, '/nasftp/');

    this.definePreferences([
      /**
       * Download mode method.
       *
       * Can be:
       * - null: Autoselect the right mode.
       * - a: Use <a> tags.
       * - fsapi: Use FileSystem APIs.
       */
      ['downloadMode', null],

      /**
       * Previous commands run.
       */
      ['history', []],
    ]);
  }
}

/**
 * Wrapper around various web methods for downloading files.
 *
 * @abstract
 */
class FileWriter {
  /**
   * @param {string} name The local filename to save as.
   * @param {{
   *   document: (!Document|undefined),
   *   window: (!Window|undefined),
   *   size: number,
   *   cli: (!Cli|undefined),
   * }=} options
   */
  constructor(name, {size, document, window, cli} = {}) {
    this.name = name;
    this.size = size;
  }

  /**
   * @param {boolean} resume
   * @return {!Promise<number>}
   */
  async init(resume) {}

  /** @param {!ArrayBuffer} chunk */
  async write(chunk) {}

  /** @return {!Promise<void>} */
  async close() {}
}

/**
 * File downloader using HTML <a> tag.
 *
 * Pro: Very little user interaction.  The filename is provided, automatically
 *     used, and if there's a collision, a diff filename is automatically used.
 * Con: The entire file is buffered in memory before saving.  This can cause
 *     Chrome to basically OOM the system.
 */
class AnchorTagFileWriter extends FileWriter {
  /** @override */
  constructor(name, {size, document}) {
    super(name, {size});
    this.document = document;
    this.chunks = [];
    this.a = null;
  }

  /** @override */
  async init(resume) {
    if (resume) {
      return Promise.reject('unimplemented');
    }

    this.a = this.document.createElement('a');
    this.a.download = this.name;

    // Need to add to the DOM to process events properly.
    this.document.body.appendChild(this.a);

    return 0;
  }

  /** @override */
  async write(chunk) {
    this.chunks.push(new Blob([chunk]));
  }

  /** @override */
  async close() {
    // Create a base64 encoded URI.
    const blob = new Blob(this.chunks);
    this.a.href = URL.createObjectURL(blob);
    this.a.click();
    this.a.remove();
    URL.revokeObjectURL(this.a.href);

    // Hint to the runtime that we're done with the chunks and they can
    // release the underlying memory/blobs.
    this.chunks.length = 0;
  }
}

/**
 * File downloader using File System APIs.
 *
 * Pro: No memory limitations.
 * Con: Requires user interaction to open initial directory.  Collisions result
 *      in silent clobbering.  Not all browsers support this (yet?).
 */
class FileSystemApiFileWriter extends FileWriter {
  /** @override */
  constructor(name, {size, window, cli}) {
    super(name, {size});
    this.window = window;
    this.cli = cli;
    this.stream = null;
  }

  /** @override */
  async init(resume) {
    if (this.cli.lcwd === null) {
      await this.cli.dispatchCommand_(['lcd']);
    }
    if (this.cli.lcwd === null) {
      // If it's still null, the user aborted selection, so give up here too.
      throw new DOMException('lcd aborted', 'AbortError');
    }

    const fsDirHandle = this.cli.lcwd;
    let fsFileHandle;
    try {
      fsFileHandle = await fsDirHandle.getFileHandle(this.name, {create: true});
    } catch (e) {
      if (e instanceof TypeError) {
        // User tried to download a file with characters the local system does
        // not allow.  For example, Chrome blocks files with ":" in them.  Force
        // them to pick the filename explicitly in this case.
        this.cli.showError_(e.toString());
        fsFileHandle = await globalThis.showSaveFilePicker({
          id: 'lcd',
          startIn: 'downloads',
          suggestedName: this.name,
        });
      } else {
        throw e;
      }
    }

    // See if we've already completed.  If we get a writable handle, Chrome will
    // create a tempfile with its contents, and this is wasteful when resuming a
    // completed file.
    const file = await fsFileHandle.getFile();
    if (resume && this.size <= file.size) {
      return file.size;
    }

    this.stream = await fsFileHandle.createWritable({
      keepExistingData: true,
    });

    if (resume) {
      await this.stream.seek(file.size);
      return file.size;
    } else {
      await this.stream.truncate(0);
      return 0;
    }
  }

  /** @override */
  async write(chunk) {
    return this.stream.write(chunk);
  }

  /** @override */
  async close() {
    if (this.stream !== null) {
      return this.stream.close();
    }
  }
}

/**
 * Get an appropriate FileWriter object for the file to transfer.
 *
 * @param {string} name The local filename to use.
 * @param {!File|!FileAttrs} attrs The remote file attributes.
 * @param {!Object} options Options to pass to the file writer.
 * @return {!FileWriter} The file writer.
 */
function getFileWriter(name, attrs, options) {
  if (globalThis.showDirectoryPicker === undefined ||
      options.prefs.get('downloadMode') === 'a') {
    return new AnchorTagFileWriter(
        name, {size: attrs.size, document: options.document});
  } else {
    return new FileSystemApiFileWriter(
        name, {size: attrs.size, window: options.window, cli: options.cli});
  }
}

/**
 * The command line sftp client.
 *
 * @param {!CommandInstance} commandInstance The command instance to bind.
 * @param {!Object=} opts Various options.
 * @constructor
 */
export function Cli(commandInstance, {localStorage} = {}) {
  // The nassh command instance we're bound to.
  this.commandInstance_ = commandInstance;

  // Various prefs that persist across sessions.
  this.prefs_ = new PreferenceManager(this.commandInstance_.syncStorage);
  if (localStorage === undefined) {
    localStorage = new lib.Storage.Local();
  }
  this.localPrefs_ = new LocalPreferenceManager(localStorage);

  // The user's terminal.
  // A local shortcut since we use it often in this class.
  this.io = this.commandInstance_.io;
  this.terminal = this.io.terminal_;

  // The sftpClient object.
  // A local shortcut since we use it often in this class.
  this.client = this.commandInstance_.sftpClient;

  // The initial remote path for the sftp client.  The user can change at
  // runtime via the `cd` command.
  this.cwd = './';

  // The initial local path for the sftp client.  The user can change at
  // runtime via the `lcd` command.
  /** @type {?FileSystemDirectoryHandle} */
  this.lcwd = null;

  // The pending user line buffer.
  this.stdin_ = '';

  // The undisplayed user input.
  this.buffered_ = '';
  this.holdInput_ = false;

  // Used to manually break a connection.
  this.killCount_ = 0;

  // Swallow unhandled errors.  This is good for release, but not for testing.
  this.swallowErrors_ = globalThis.chai === undefined;

  // Command line history.
  this.history_ = [];
  this.historyPosition_ = -1;
  this.historyStash_ = '';

  // The color settings for this session.  Enabled by default.
  this.colorMap_ = {};
  this.toggleColors_(true);

  // The prompt settings for this session.
  this.prompt_ = null;

  // Whether the user has interrupted long running commands.
  this.userInterrupted_ = false;

  // Bind user input functions.
  this.io.sendString = this.io.onVTKeystroke =
      /** @type {function(this:hterm.Terminal.IO, string)} */ (
          this.onInput_.bind(this));

  // Set up keyboard shortcuts.
  this.terminal.keyboard.bindings.addBindings({
    'Ctrl+C': this.onCtrlCKey_.bind(this),
    'Ctrl+D': this.onCtrlDKey_.bind(this),
    'Ctrl+H': this.onBackspaceKey_.bind(this),
    'Ctrl+I': this.onTabKey_.bind(this),
    // Open the brower's downloads page.
    'Ctrl+J': hterm.Keyboard.KeyActions.PASS,
    'Ctrl+L': this.onCtrlLKey_.bind(this),
    'Ctrl+U': this.onCtrlUKey_.bind(this),
    'Ctrl+W': this.onCtrlWKey_.bind(this),
    'Ctrl+220': this.onCtrlBackslashKey_.bind(this),
    'Backspace': this.onBackspaceKey_.bind(this),
    'Delete': hterm.Keyboard.KeyActions.CANCEL,
    'Tab': this.onTabKey_.bind(this),
    'Up': this.onUpArrowKey_.bind(this),
    'Down': this.onDownArrowKey_.bind(this),
    'Left': hterm.Keyboard.KeyActions.CANCEL,
    'Right': hterm.Keyboard.KeyActions.CANCEL,
    'PgDown': hterm.Keyboard.KeyActions.CANCEL,
    'PgUp': hterm.Keyboard.KeyActions.CANCEL,
    'Home': hterm.Keyboard.KeyActions.CANCEL,
    'End': hterm.Keyboard.KeyActions.CANCEL,
  });

  // Take care of translating the available commands.
  this.commands_ = this.translateCommands(Cli.commands);
}

/**
 * Start the nasftp command.
 */
Cli.prototype.run = async function() {
  await this.prefs_.readStorage();
  await this.localPrefs_.readStorage();

  const prompt = this.prefs_.get('prompt');
  if (typeof prompt === 'string') {
    this.prompt_ = prompt;
  } else {
    this.prefs_.reset('prompt');
  }

  if (!this.prefs_.getBoolean('color')) {
    // Assume colors default to on, so we only have to turn them off.
    this.toggleColors_(false);
  }

  const history = this.localPrefs_.get('history');
  if (Array.isArray(history)) {
    // Create a copy so we don't mutate the value in storage.
    this.history_ = [...history];
  } else {
    this.localPrefs_.reset('history');
  }

  // Now that we're ready, show the user the prompt.
  this.showPrompt_();
};

/**
 * Convert control characters to avoid the terminal interpreting them.
 *
 * Unicode provides a Control Pictures block for graphically displaying these.
 *
 * @param {string=} string The string to filter.
 * @return {string} The escaped string for printing.
 */
Cli.prototype.escapeString_ = function(string = '') {
  const map = (ch) => {
    const cp = ch.codePointAt(0);
    return String.fromCodePoint(cp == 0x7f ? 0x2421 : cp + 0x2400);
  };
  // eslint-disable-next-line no-control-regex
  return string.replace(/[\x00-\x08\x0a-\x1f\x7f]/g, map);
};

/**
 * Format a number for humans to read using SI units.
 *
 * @param {number} number The number to format.
 * @return {string} The formatted number.
 */
Cli.format_ = function(number) {
  const sfx = 'BKMGTPEZY';
  let i = 1;
  while (i < sfx.length && Math.pow(1024, i) < number) {
    ++i;
  }
  --i;
  if (i == 0) {
    return `${number} B`;
  } else {
    number = Math.round(number / Math.pow(1024, i) * 10) / 10;
    return `${number} ${sfx[i]}iB`;
  }
};

/**
 * Convert control characters to avoid the terminal interpreting them.
 *
 * Unicode provides a Control Pictures block for graphically displaying these.
 *
 * @param {string=} string The string to filter and display.
 */
Cli.prototype.rawprint_ = function(string = '') {
  this.io.print(this.escapeString_(string));
};

/**
 * Like rawprint_, but includes a newline.
 *
 * @param {string} string The string to filter and display.
 */
Cli.prototype.rawprintln_ = function(string) {
  this.rawprint_(string);
  this.io.println('');
};

/**
 * Run a specific internal command.
 *
 * @param {string|!Array<string>} userArgs The command to run.
 * @return {!Promise} A promise that resolves once the command finishes.
 */
Cli.prototype.dispatchCommand_ = function(userArgs) {
  let args;
  if (typeof userArgs == 'string') {
    // The existing func isn't great, but it's better than nothing.
    const cmdline = splitCommandLine(userArgs);
    args = cmdline.args;
  } else if (Array.isArray(userArgs)) {
    args = Array.from(userArgs);
  }
  const cmd = args.shift();
  args.cmd = cmd;

  if (!this.commands_.hasOwnProperty(cmd)) {
    return Promise.reject(cmd);
  }
  const handler = this.commands_[cmd];

  const showCrash = (e) => {
    this.showError_(localize('NASFTP_ERROR_INTERNAL', [e]));
    const lines = e.stack.split(/[\r\n]/);
    lines.forEach((line) => this.rawprintln_(line));
  };

  try {
    return handler.call(this, args)
      .catch((response) => {
        if (response instanceof StatusError) {
          this.showSftpStatusError_(response, args.cmd);
        } else {
          // Don't swallow test failures, but diagnosis the others via the
          // command output.  This avoids bugs in one command crashing the
          // entire program.
          if (!this.swallowErrors_) {
            throw response;
          }
          showCrash(response);
        }
      });
  } catch (e) {
    if (!this.swallowErrors_) {
      throw e;
    }
    showCrash(e);
    return Promise.reject();
  }
};

/**
 * Process a single character from the user.
 *
 * If the user hasn't committed the command (hit enter), queue into stdin.
 *
 * @param {string} ch The character to process.
 * @return {!Promise} A promise that resolves once the command finishes.
 */
Cli.prototype.onInputChar_ = function(ch) {
  // New input means we reset the force quit counter.
  this.killCount_ = 0;

  // Wait for the command to commit (hit enter).
  if (ch == '\n' || ch == '\r') {
    this.io.println('');

    // Strip leading & trailing whitespace before processing.
    let data = this.stdin_.replace(/^\s*/, '');
    data = data.replace(/\s*$/, '');

    return new Promise((resolve) => {
      /**
       * Finish up the command processing.
       *
       * @param {!Event=} e When called by unhandledrejection,
       *     the event with the uncaught promise that we need to handle.
       */
      const finishCommand = (e) => {
        globalThis.removeEventListener('unhandledrejection', finishCommand);
        resolve();

        if (e) {
          if (e.reason instanceof StatusError) {
            this.showSftpStatusError_(e.reason, data);
          } else {
            this.showError_(localize('NASFTP_ERROR_INTERNAL', [e.reason]));
          }
        }

        // Add non-empty non-recent-duplicate entries into the history.
        if (this.stdin_.length && this.history_[0] !== this.stdin_) {
          this.history_.unshift(this.stdin_);
          if (this.history_.length > 100) {
            this.history_.length = 100;
          }
          // Create a copy so we don't mutate the value in storage.
          this.localPrefs_.set('history', [...this.history_]);
        }
        this.historyPosition_ = -1;
        this.stdin_ = '';

        // If we've exited, don't show anything more.
        if (this.commandInstance_.exited_) {
          return;
        }

        // Once we've finished processing the single command, show the prompt.
        this.showPrompt_();
        // If the user interrupted us, clear all queued/pending data too.
        if (this.userInterrupted_) {
          this.buffered_ = '';
        }
        this.userInterrupted_ = false;
      };

      // If the subcommand uses an async handler that rejects or crashes,
      // catch it and recover gracefully.
      globalThis.addEventListener('unhandledrejection', finishCommand);

      // Dispatch the command and wait for it to finish.
      return this.dispatchCommand_(data)
        .catch((cmd) => {
          // Don't warn when the user just hits enter w/out a command.
          if (cmd) {
            this.showError_(localize('NASFTP_ERROR_UNKNOWN_CMD', [cmd]));
          }
        })
        .finally(finishCommand);
    });
  } else {
    // Eat various unprintable chars.  Queue the rest into stdin.
    if (ch.codePointAt(0) >= 0x20) {
      this.stdin_ += ch;
      this.io.print(ch);
    }
    return Promise.resolve();
  }
};

/**
 * Callback when user has sent us data.
 *
 * e.g. When typing on the keyboard or pasting strings.
 *
 * @param {string} string The string of characters to process.
 * @return {!Promise<void>} A promise that resolves once all processing is done.
 */
Cli.prototype.onInput_ = async function(string) {
  // If we got an empty event, just return;
  if (string.length == 0) {
    return;
  }
  this.buffered_ += string;

  // If we're in the middle of processing a command, only queue new input.
  if (this.holdInput_) {
    return;
  }

  this.holdInput_ = true;
  try {
    while (this.buffered_.length) {
      // Note: This splits UTF-16 surrogate pairs incorrectly.  However, this
      // shouldn't be a problem in practice as we only run commands based on
      // newlines, and the commands should only match on complete strings.
      const ch = this.buffered_[0];
      this.buffered_ = this.buffered_.slice(1);

      await this.onInputChar_(ch);
    }
  } finally {
    this.holdInput_ = false;
  }
};

/**
 * Callback for handling interrupt requests (Ctrl+C).
 *
 * @return {!hterm.Keyboard.KeyActions}
 */
Cli.prototype.onCtrlCKey_ = function() {
  // If we're processing a command still, don't do anything.
  if (this.holdInput_) {
    this.userInterrupted_ = true;
    this.io.println('^C');

    return hterm.Keyboard.KeyActions.CANCEL;
  }

  this.stdin_ = '';
  this.io.println('^C');
  this.showPrompt_();

  return hterm.Keyboard.KeyActions.CANCEL;
};

/**
 * Callback for handling end-of-input requests (Ctrl+D).
 *
 * @return {!hterm.Keyboard.KeyActions}
 */
Cli.prototype.onCtrlDKey_ = function() {
  // If we're processing a command still, don't do anything.
  if (this.holdInput_) {
    return hterm.Keyboard.KeyActions.CANCEL;
  }

  if (this.stdin_ == '') {
    this.io.println('');
    Cli.commandQuit_.call(this, []);
  }

  return hterm.Keyboard.KeyActions.CANCEL;
};

/**
 * Callback for handling clear screen requests (Ctrl+L).
 *
 * @return {!hterm.Keyboard.KeyActions}
 */
Cli.prototype.onCtrlLKey_ = function() {
  // If we're processing a command still, don't do anything.
  if (this.holdInput_) {
    return hterm.Keyboard.KeyActions.CANCEL;
  }

  this.terminal.clearHome();
  this.showPrompt_();
  this.io.print(this.stdin_);

  return hterm.Keyboard.KeyActions.CANCEL;
};

/**
 * Callback for handling clear line requests (Ctrl+U).
 *
 * @return {!hterm.Keyboard.KeyActions}
 */
Cli.prototype.onCtrlUKey_ = function() {
  // If we're processing a command still, don't do anything.
  if (this.holdInput_) {
    return hterm.Keyboard.KeyActions.CANCEL;
  }

  this.stdin_ = '';
  this.terminal.eraseToLeft();
  this.terminal.setCursorColumn(0);
  this.showPrompt_();

  return hterm.Keyboard.KeyActions.CANCEL;
};

/**
 * Callback for handling delete word requests (Ctrl+W).
 *
 * @return {!hterm.Keyboard.KeyActions}
 */
Cli.prototype.onCtrlWKey_ = function() {
  // If we're processing a command still, don't do anything.
  if (this.holdInput_) {
    return hterm.Keyboard.KeyActions.CANCEL;
  }

  // Delete the last word and any whitespace after it.
  // If there are no words left, eat all the whitespace.
  this.stdin_ = this.stdin_.replace(/(^\s+|[^\s]+)\s*$/, '');

  this.terminal.eraseToLeft();
  this.terminal.setCursorColumn(0);
  this.showPrompt_();
  this.io.print(this.stdin_);

  return hterm.Keyboard.KeyActions.CANCEL;
};

/**
 * Callback for handling quit requests (Ctrl+\).
 *
 * @return {!hterm.Keyboard.KeyActions}
 */
Cli.prototype.onCtrlBackslashKey_ = function() {
  if (this.holdInput_) {
    if (++this.killCount_ > 2) {
      this.io.println(localize('NASFTP_FORCE_QUIT'));
      Cli.commandQuit_.call(this, []);
    }
  }

  return hterm.Keyboard.KeyActions.CANCEL;
};

/**
 * Callback for handling backspace keys.
 *
 * @return {!hterm.Keyboard.KeyActions}
 */
Cli.prototype.onBackspaceKey_ = function() {
  // If we're processing a command still, don't do anything.
  if (this.holdInput_) {
    return hterm.Keyboard.KeyActions.CANCEL;
  }

  if (this.stdin_.length) {
    this.stdin_ = this.stdin_.slice(0, -1);
    this.io.print('\b \b');
  }

  return hterm.Keyboard.KeyActions.CANCEL;
};

/**
 * @typedef {{
 *   arg: string,
 *   matches: !Array<string>,
 *   colorize: (!Object<string, string>|undefined),
 *   skip: (number|undefined),
 * }}
 */
Cli.Completion;

/**
 * Complete a CLI command.
 *
 * Match partial command names like "he" into "help".
 *
 * @param {string} input The argument to complete.
 * @return {!Cli.Completion} The set of commands that matcht he input.
 */
Cli.prototype.completeCommand_ = function(input) {
  const matches = [];
  for (const command in this.commands_) {
    // Hack: don't expand internal commands unless explicitly requested.
    if (input.length == 0 && command.startsWith('_')) {
      continue;
    }

    // Add commands that match the user's input.
    if (command.startsWith(input)) {
      matches.push(command);
    }
  }
  return /** @type {!Cli.Completion} */ ({arg: input, matches});
};

/**
 * Complete CLI options.
 *
 * Display all valid short options for this particular command.  If the option
 * has already been used, it will not be suggested.  If the arguments include
 * --, then processing halts and no matches will suggested.  If a non-option
 * argument is encountered, we also stop processing.
 *
 * @param {!Array<string>} args The current command line arguments.
 * @param {string} opts The valid short options.
 * @return {?Cli.Completion} The short options that match.
 */
Cli.prototype.completeCommandOptions_ = function(args, opts) {
  // Walk the args the user has already provided and pull out options.
  const matches = new Set(opts.split(''));

  for (let i = 1; i < args.length; ++i) {
    const arg = args[i];
    // Stop parsing at -- to delimit options from arguments.
    if (arg == '--') {
      return null;
    }

    // If this isn't an option, assume everything remaining is also not.
    if (arg[0] != '-') {
      return null;
    }

    // Record these options so we don't suggest them as completions.
    arg.substr(1).split('').forEach((c) => matches.delete(c));
  }

  return /** @type {!Cli.Completion} */ ({
    arg: args[args.length - 1],
    matches: Array.from(matches).sort().map((opt) => `-${opt}`),
  });
};

/**
 * Complete paths against the remote system.
 *
 * @param {!Array<string>} args The current command line arguments.
 * @param {function(string, (!File|!FileAttrs))=} filter Callback to filter
 *     possible matches.
 * @return {!Promise<!Cli.Completion>} The remote paths that match.
 */
Cli.prototype.completeRemotePath_ = async function(
    args, filter = undefined) {
  const input = args[args.length - 1];
  const lastSlash = input.lastIndexOf('/') + 1;
  const parent = input.substr(0, lastSlash);
  const lastpath = input.substr(lastSlash);
  const expandedParent = this.makePath_(parent);

  const matches = await
    this.client.openDirectory(expandedParent)
      .then((handle) => {
        // Enumerate all the entries in this path.
        return this.client.scanDirectory(handle, (entry) => {
          if (this.userInterrupted_) {
            return;
          }

          // Skip dot paths unless input starts with an explicit dot.
          if (!lastpath && entry.filename[0] === '.') {
            return false;
          } else if (!entry.filename.startsWith(lastpath)) {
            return false;
          }

          return filter ? filter(expandedParent, entry) : true;
        })
        .finally(() => this.client.closeFile(handle));
      });

  const fullPaths = matches.map((entry) => {
    let ret = parent + entry.filename;
    if (entry.isDirectory) {
      ret += '/';
    }
    return ret;
  });
  return /** @type {!Cli.Completion} */ ({
    arg: input,
    matches: fullPaths,
    colorize: matches.reduce((color, entry, i) => {
      color[fullPaths[i]] = this.getColorForAttrs_(entry);
      return color;
    }, {}),
    skip: parent.length,
  });
};

/**
 * Helper to expand a symlink for completion purposes.
 *
 * This will retain the original entry, but replace some of the attributes with
 * attributes of the target of the symlink.  The isLink field will still be left
 * alone, so the caller can detect the situation if need be.
 *
 * @param {string} parent The expanded parent path for this entry.
 * @param {(!File|!FileAttrs)} entry Path to check.
 * @return {!Promise<(!File|!FileAttrs)>} Path with symlinked attrs expanded.
 */
Cli.prototype.completeResolveTargetAttrs_ = async function(parent, entry) {
  if (entry.isLink) {
    // If it's a symlink, resolve the target for file/directory stats.
    await this.client.fileStatus(`${parent}/${entry.filename}`)
      .then((attrs) => {
        entry.isDirectory = attrs.isDirectory;
        entry.isRegularFile = attrs.isRegularFile;
      })
      .catch((e) => {
        // If the symlink is broken, we'll get an error, so ignore it.  Don't
        // swallow any other errors though (like test failures).
        if (!(e instanceof StatusError)) {
          throw e;
        }
      });
  }

  return entry;
};

/**
 * Helper to only complete directories.
 *
 * Symlinks to directories will also be included.
 *
 * @param {!Array<string>} args The current command line arguments.
 * @param {boolean=} onlyDirs Only return directories.
 * @return {!Promise<!Cli.Completion>} The remote paths that match.
 */
Cli.prototype.completeResolvedRemotePath_ = async function(
    args, onlyDirs = false) {
  return this.completeRemotePath_(args, (parent, entry) => {
    return this.completeResolveTargetAttrs_(parent, entry)
      .then((entry) => {
        if (onlyDirs) {
          return entry.isDirectory ? entry : false;
        } else {
          return entry;
        }
      });
  });
};

/**
 * Callback for handling autocomplete matches.
 *
 * @return {!hterm.Keyboard.KeyActions}
 */
Cli.prototype.onTabKey_ = function() {
  // If we're processing a command still, don't do anything.
  if (this.holdInput_) {
    return hterm.Keyboard.KeyActions.CANCEL;
  }

  // Since hterm does not support async callbacks, we handle it ourselves by
  // holding any further input until we finish processing.
  this.holdInput_ = true;
  this.completeInputBuffer_(this.stdin_)
    .then((result) => {
      if (!result) {
        result = {arg: this.stdin_, matches: []};
      }
      const {arg, matches, colorize, skip} = result;
      return this.completeFinishMatches_(arg, matches, colorize, skip);
    })
    .finally(() => this.holdInput_ = false);

  return hterm.Keyboard.KeyActions.CANCEL;
};

/**
 * Find possible completions for a command line.
 *
 * This takes care of tokenizing and dispatching to the right subcompleter
 * depending on what part of the command line the user is completing.
 *
 * @param {string} buffer The command line to complete.
 * @return {!Promise<?Cli.Completion>} Completion results.
 */
Cli.prototype.completeInputBuffer_ = async function(buffer) {
  // Autocomplete based on the position in the command.
  const ary = buffer.split(/\s+/);
  let input;
  if (ary.length === 1) {
    // Complete the first arg which is the command.
    input = ary[0];
    return this.completeCommand_(input);
  }

  // Support completing of command arguments.
  const cmd = ary[0];
  if (!this.commands_.hasOwnProperty(cmd)) {
    // Unknown command.
    return {arg: cmd, matches: []};
  }

  // If the command has an option completer, run it.
  const handler = this.commands_[cmd];
  if (handler.optstring) {
    // Try to see if we want to match command line options.
    const result = this.completeCommandOptions_(ary, handler.optstring);
    if (result) {
      return result;
    }

    // completeCommandOptions_ handled option parsing vs arguments, so if we're
    // still here, we can try completing the argument even if it starts with -.
  }

  // If the command has an argument completer, run it.
  const completer = handler.complete;
  if (completer) {
    return completer.call(this, ary);
  }

  return null;
};

/**
 * Process the set of possible completions.
 *
 * This takes the set of completions found and updates the UI accordingly.  It
 * might do the actual completion, or it might show all the possibilities for
 * the user to refine.
 *
 * @param {string} arg The specific argument that is being completed.
 * @param {!Array<string>} matches All the matching completions.
 * @param {?Object<string, string>=} colorize How to color each completion.
 * @param {number=} skip How many leading characters to skip when showing
 *     completions.  This provides tigher output when the prefix is the same
 *     among all completions.
 */
Cli.prototype.completeFinishMatches_ = async function(
    arg, matches, colorize = {}, skip = 0) {
  // Workaround closure compiler that ignores !undefined assertion.
  const skip_ = lib.notUndefined(skip);

  // Process the matches.
  switch (matches.length) {
    case 0: {
      // No matches.
      this.terminal.ringBell();
      break;
    }

    case 1: {
      // Exactly one match -- complete it.
      let complete = matches[0].substr(arg.length);
      // If we're completing a directory, don't finish the argument.  This
      // allows quick completion of subdirs by pressing Tab multiple times.
      // This is a bit of a heuristic, but we don't use / for anything else
      // atm, so it's OK.
      if (!complete.endsWith('/')) {
        complete += ' ';
      }
      this.io.print(complete);
      this.stdin_ += complete;
      break;
    }

    default: {
      // More than one match.
      // See if there's a common prefix we can autocomplete first.
      const partial = lib.f.longestCommonPrefix(matches);
      if (partial > arg.length) {
        const complete = matches[0].substr(arg.length, partial - arg.length);
        this.io.print(complete);
        this.stdin_ += complete;
        break;
      }

      // Show all the completions.
      this.terminal.ringBell();
      this.io.println('');
      // Figure out the max width of the matches so we can print them all in
      // tidy columns.  They're currently sorted left-to-right rather than
      // top-to-bottom as it's easier (read: lazier) to do it this way.
      const maxWidth = matches.reduce(
          (a, b) => Math.max(a, b.length - skip_), 0) + 3;
      const perLine = Math.floor(this.terminal.screenSize.width / maxWidth);
      let lineCount = 0;
      matches.sort().forEach((complete) => {
        const color = colorize[complete];
        if (color) {
          this.io.print(color);
        }
        this.io.print(complete.substr(skip_).padEnd(maxWidth));
        if (color) {
          this.io.print(this.colorMap_['reset']);
        }
        if (++lineCount >= perLine) {
          this.io.println('');
          lineCount = 0;
        }
      });
      if (lineCount) {
        this.io.println('');
      }
      this.showPrompt_();
      this.io.print(this.stdin_);
      break;
    }
  }
};

/**
 * Callback for moving back in command history.
 *
 * @return {!hterm.Keyboard.KeyActions}
 */
Cli.prototype.onUpArrowKey_ = function() {
  // If we're processing a command still, don't do anything.
  if (this.holdInput_) {
    return hterm.Keyboard.KeyActions.CANCEL;
  }

  if (this.historyPosition_ + 1 >= this.history_.length) {
    // At the end of the history.
    return hterm.Keyboard.KeyActions.CANCEL;
  }

  this.historyPosition_++;

  if (this.historyPosition_ == 0) {
    this.historyStash_ = this.stdin_;
  }

  this.stdin_ = this.history_[this.historyPosition_];
  this.terminal.eraseToLeft();
  this.terminal.setCursorColumn(0);
  this.showPrompt_();
  this.rawprint_(this.stdin_);

  return hterm.Keyboard.KeyActions.CANCEL;
};

/**
 * Callback for moving forward in command history.
 *
 * @return {!hterm.Keyboard.KeyActions}
 */
Cli.prototype.onDownArrowKey_ = function() {
  // If we're processing a command still, don't do anything.
  if (this.holdInput_) {
    return hterm.Keyboard.KeyActions.CANCEL;
  }

  if (this.historyPosition_ - 1 < -1) {
    // At the start of the history.
    return hterm.Keyboard.KeyActions.CANCEL;
  }

  this.historyPosition_--;

  if (this.historyPosition_ == -1) {
    this.stdin_ = this.historyStash_;
  } else {
    this.stdin_ = this.history_[this.historyPosition_];
  }

  this.terminal.eraseToLeft();
  this.terminal.setCursorColumn(0);
  this.showPrompt_();
  this.rawprint_(this.stdin_);

  return hterm.Keyboard.KeyActions.CANCEL;
};

/**
 * Color settings for the interface.
 */
export const defaultColorMap = {
  'reset': {},
  'bold': {bold: true},
  'prompt': {bold: true, fg: 30},
  'error': {bold: true, fg: 31},
  'warning': {bold: true, fg: 33},
  // File types.
  'dir': {bold: true, fg: 34},
  'sym': {bold: true, fg: 36},
  'fifo': {bold: true, fg: 33, bg: 40},
  'socket': {bold: true, fg: 35},
  'char': {bold: true, fg: 33, bg: 40},
  'block': {bold: true, fg: 33, bg: 40},
};

/**
 * Toggle color usage in output.
 *
 * @param {boolean=} state Whether to toggle or set color usage.
 */
Cli.prototype.toggleColors_ = function(state = undefined) {
  if (state === undefined) {
    state = !this.colorMap_['prompt'];
  }

  if (!state) {
    Object.keys(defaultColorMap).forEach((key) => {
      this.colorMap_[key] = '';
    });
  } else {
    this.colorMap_ = Object.assign({}, defaultColorMap);
  }

  // Always keep 'reset' working for the prompt.
  this.colorMap_['reset'] = defaultColorMap['reset'];
};

/**
 * Cache the SGR sequences.
 */
Object.entries(defaultColorMap).forEach(([key, setting]) => {
  defaultColorMap[key] = sgrSequence(setting);
});

/**
 * Return color for a path based on its attributes.
 *
 * @param {!File|!FileAttrs} attrs The path attributes.
 * @return {?string} The color.
 */
Cli.prototype.getColorForAttrs_ = function(attrs) {
  // NB: Check link before others.
  if (attrs.isLink) {
    return this.colorMap_['sym'];
  } else if (attrs.isDirectory) {
    return this.colorMap_['dir'];
  } else if (attrs.isCharacterDevice) {
    return this.colorMap_['char'];
  } else if (attrs.isBlockDevice) {
    return this.colorMap_['block'];
  } else if (attrs.isFifo) {
    return this.colorMap_['fifo'];
  } else if (attrs.isSocket) {
    return this.colorMap_['socket'];
  } else {
    return null;
  }
};

/**
 * Helper to show the CLI prompt to the user.
 *
 * TODO: Allow customization.
 */
Cli.prototype.showPrompt_ = function() {
  let prompt = this.prompt_;
  const defaultPrompt = localize('NASFTP_PROMPT', ['%(cwd)']);
  if (prompt === null) {
    // Normally one should not mess with translation text.  But it's a bit hard
    // to preserve colorization settings.  So hand insert it if possible.
    prompt = defaultPrompt.replace('nasftp', '%(prompt)nasftp%(reset)');
  } else if (this.prompt_ == '') {
    prompt = defaultPrompt.replace(
        'nasftp',
        '%(bold)' +
        sgrSequence({fg: '38:2:51:105:232'}) + 'n' +
        sgrSequence({fg: '38:2:213:15:37'}) + 'a' +
        sgrSequence({fg: '38:2:238:178:17'}) + 's' +
        sgrSequence({fg: '38:2:51:105:232'}) + 'f' +
        sgrSequence({fg: '38:2:0:153:37'}) + 't' +
        sgrSequence({fg: '38:2:213:15:37'}) + 'p' +
        '%(reset)');
  }

  const vars = Object.assign({}, this.colorMap_, {
    'cwd': this.escapeString_(this.cwd),
  });

  this.io.print(lib.f.replaceVars(prompt, vars));
};

/**
 * Helper to show error messages to the user.
 *
 * @param {string} msg The message to show.
 */
Cli.prototype.showError_ = function(msg) {
  this.io.println(localize('NASFTP_ERROR_MESSAGE', [msg]));
};

/**
 * Helper to decode SFTP status errors for the user.
 *
 * @param {!StatusError} response The status error packet.
 * @param {string} cmd The current command we're processing.
 */
Cli.prototype.showSftpStatusError_ = function(response, cmd) {
  let msgId;
  const msgArgs = [cmd];
  switch (response.code) {
    case StatusCodes.EOF:
      msgId = 'NASFTP_ERROR_END_OF_FILE';
      break;
    case StatusCodes.NO_SUCH_FILE:
      msgId = 'NASFTP_ERROR_FILE_NOT_FOUND';
      break;
    case StatusCodes.PERMISSION_DENIED:
      msgId = 'NASFTP_ERROR_PERMISSION_DENIED';
      break;
    default:
      msgId = 'NASFTP_ERROR_SERVER_ERROR';
      msgArgs.push(response.message);
      break;
  }
  this.showError_(localize(msgId, msgArgs));
};

/**
 * Helper to parse user numbers.
 *
 * @param {string} cmd The command whose args we are parsing.
 * @param {string} argName The human readable name for the argument.
 * @param {string} argValue The argument from the user to parse.
 * @param {number=} defaultValue The default value.
 * @param {number=} radix The radix to parse the argument.
 * @return {?number} The parsed number, or false if the value is invalid.
 */
Cli.prototype.parseInt_ = function(
    cmd, argName, argValue, defaultValue = 0, radix = undefined) {
  if (argValue === undefined) {
    return defaultValue;
  }

  let ret = parseInt(argValue, radix);
  if (!isFinite(ret)) {
    this.showError_(localize('NASFTP_ERROR_INVALID_NUMBER', [
      cmd, argName, argValue,
    ]));
    return null;
  }

  // Handle optional size units.
  const knownSuffix = 'KMGTPEZY';
  let scale = 1;
  let offset;
  if (argValue.endsWith('iB')) {
    scale = 1024;
    offset = 3;
  } else if (argValue.endsWith('B')) {
    scale = 1000;
    offset = 2;
  } else if (knownSuffix.includes(argValue[argValue.length - 1])) {
    scale = 1024;
    offset = 1;
  }
  if (offset !== undefined) {
    const sfx = argValue[argValue.length - offset];
    if (!knownSuffix.includes(sfx)) {
      this.showError_(localize('NASFTP_ERROR_INVALID_NUMBER', [
        cmd, argName, argValue,
      ]));
      return null;
    }
    for (const s of knownSuffix) {
      ret *= scale;
      if (s === sfx) {
        break;
      }
    }
  }

  return ret;
};

/**
 * Parse command line options from the arguments.
 *
 * The args array is mutated in place to remove processed options.
 * The -- marker can be used to stop any further processing.
 *
 * All known & seen short options will be set in the return value.
 * e.g. optstring='s' and '-s' will return {'s': true}.
 *
 * @param {!Array<string>} args The command line arguments to parse.
 * @param {string} optstring List of valid short options.
 * @return {?Object} Object holding the parsed values.
 */
Cli.prototype.parseOpts_ = function(args, optstring) {
  const opts = {};

  while (args.length) {
    const arg = args[0];

    if (arg == '--') {
      args.shift();
      break;
    } else if (arg.startsWith('-')) {
      const flags = arg.substr(1);
      for (let f = 0; f < flags.length; ++f) {
        const opt = flags[f];
        if (optstring.indexOf(opt) == -1) {
          this.showError_(localize(
              'NASFTP_ERROR_UNKNOWN_OPTION', [args.cmd, opt]));
          return null;
        } else {
          opts[opt] = true;
        }
      }
      args.shift();
    } else {
      break;
    }
  }

  return opts;
};

/**
 * Create an absolute path that respects the user's cwd setting.
 *
 * @param {string} path The path (relative or absolute) to convert.
 * @return {string} The absolute path.
 */
Cli.prototype.basename = function(path) {
  const ary = path.replace(/\/+$/, '').split('/');
  return ary[ary.length - 1];
};

/**
 * Create an absolute path that respects the user's cwd setting.
 *
 * @param {string} path The path (relative or absolute) to convert.
 * @return {string} The absolute path.
 */
Cli.prototype.makePath_ = function(path) {
  return path.startsWith('/') ? path : this.cwd + path;
};

/**
 * Process the queued commands and translate their text.
 *
 * @param {!Object} commands A map of registered commands and their callbacks.
 * @return {!Object} The command map with translated strings.
 */
Cli.prototype.translateCommands = function(commands) {
  const rv = {};

  let msgId;
  let msg;
  for (const command in commands) {
    const obj = commands[command];
    const upper = command.toUpperCase();

    // Always register the classic program name (e.g. `ls`).
    rv[command] = obj;

    // If a different translation is available, register it too.
    msgId = `NASFTP_CMD_${upper}`;
    msg = localize(msgId);
    if (msg != msgId) {
      rv[msg] = obj;
    }

    // Add the help translation text if available.
    msgId += '_HELP';
    msg = localize(msgId);
    if (msg != msgId) {
      obj.help = msg;
    } else {
      const ref = commands[obj.help];
      if (ref) {
        obj.help = ref.help;
      }
    }
  }

  return rv;
};

/**
 * All the commands available to the user.
 */
Cli.commands = {};

/**
 * Helper to register a command.
 *
 * @param {!Array<string>} commands The commands (and aliases) to register.
 * @param {number} minArgs The minimum number of arguments this command needs.
 * @param {?number} maxArgs The maximum number of arguments this command
 *     accepts.
 * @param {string} optstring Supported short options.
 * @param {string} usage Example command arguments.
 * @param {function(!Array<string>, !Object): !Promise<void>} callback The
 *     function to run the command.
 * @param {function(!Array<string>):
 *         !Promise<?Cli.Completion>=} completer Helper for completing
 *     arguments.
 */
Cli.addCommand_ = function(
    commands, minArgs, maxArgs, optstring, usage, callback,
    completer = undefined) {
  commands.forEach((command) => {

    /**
     * @this {Cli}
     * @param {!Array<string>} args
     * @return {!Promise<void>}
     */
    const wrapper = function(args) {
      // Parse the options first.  Always run this to support -- even if the
      // command doesn't support short options otherwise.
      const opts = this.parseOpts_(args, optstring);
      if (opts === null) {
        return Promise.resolve();
      }

      // Now check the set of arguments.
      if (args.length < minArgs) {
        this.showError_(localize('NASFTP_ERROR_NOT_ENOUGH_ARGS', [args.cmd]));
        return Promise.resolve();
      }

      if (maxArgs !== null && args.length > maxArgs) {
        this.showError_(localize('NASFTP_ERROR_TOO_MANY_ARGS', [args.cmd]));
        return Promise.resolve();
      }

      return callback.call(this, args, opts);
    };

    Cli.commands[command] = wrapper;
    wrapper.command = command;
    wrapper.complete = completer;
    wrapper.optstring = optstring;
    wrapper.usage = optstring ? `[-${optstring}] ${usage}` : usage;
    // We'll fill this in later during the translation step.
    wrapper.help = commands[0];
  });
};

/**
 * User command to dump a file.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandCat_ = function(args) {
  const path = args.shift();
  const offset = this.parseInt_(args.cmd, 'offset', args.shift());
  let length = this.parseInt_(args.cmd, 'length', args.shift(), -1);

  if (length === null || offset === null) {
    return Promise.resolve();
  }

  if (length < 0) {
    length = undefined;
  }

  // Keep track if we displayed something w/out a newline.
  let finalNewline = true;
  const td = new TextDecoder();

  const handleChunk = (chunk) => {
    if (this.userInterrupted_) {
      return false;
    }

    chunk = td.decode(chunk, {stream: true});
    let start = 0;

    while (start < chunk.length) {
      const pos = chunk.indexOf('\n', start);
      if (pos == -1) {
        // We've hit the end of the newlines.
        if (start < chunk.length) {
          finalNewline = false;
          this.rawprint_(chunk.slice(start));
        }
        return;
      }

      let dispPos = pos;
      // Strip off DOS line endings if they exist.
      if (chunk[dispPos - 1] == '\r') {
        dispPos -= 1;
      }
      finalNewline = true;
      this.rawprintln_(chunk.slice(start, dispPos));

      start = pos + 1;
    }
  };

  return this.client.readFile(this.makePath_(path), handleChunk, offset, length)
    .then(() => {
      if (!finalNewline) {
        this.io.println('');
      }
    });
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<?Cli.Completion>} Possible completions.
 */
Cli.completeCat_ = async function(args) {
  // Only complete the first argument.
  if (args.length <= 2) {
    return this.completeResolvedRemotePath_(args);
  }
  return null;
};
Cli.addCommand_(['cat'], 1, 3, '', '<path> [offset] [length]',
                Cli.commandCat_, Cli.completeCat_);

/**
 * User command to change the directory.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandCd_ = function(args) {
  // Make sure the path ends in a slash to make logic simpler.
  const normalize = (path) => path.replace(/\/*$/, '') + '/';

  let cwd = args.shift();
  if (cwd === undefined) {
    cwd = '.';
  } else if (cwd == '~' || cwd.startsWith('~/')) {
    // We don't support ~user/ syntax since SFTPv3 offers no way of looking up
    // a user homedir based on username or uid.  Only the current user.
    cwd = `.${cwd.slice(1)}`;
  } else {
    cwd = this.makePath_(cwd);
  }

  return this.client.realPath(cwd)
    .then((entries) => {
      // There should be only one result, but who knows!
      if (entries.files.length == 1) {
        const normcwd = normalize(entries.files[0].filename);
        return this.client.fileStatus(normcwd)
          .then(() => {
            // We could check attrs.isDirectory, but we already made sure the
            // path ends with a / which means the remote asserted it's a dir.
            this.cwd = normcwd;
          });
      } else {
        this.showError_(`${args.cmd}: too many results to realpath!?`);
        entries.files.forEach((file) => this.showError_(` ${file.filename}`));
      }
    });
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<?Cli.Completion>} Possible completions.
 */
Cli.completeCd_ = async function(args) {
  // Only complete the first path.
  if (args.length === 2) {
    return this.completeResolvedRemotePath_(args, true);
  }
  return null;
};
Cli.addCommand_(['chdir', 'cd'], 0, 1, '', '[path]',
                Cli.commandCd_, Cli.completeCd_);

/**
 * User command to change path permissions.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandChmod_ = function(args) {
  const mode = this.parseInt_(args.cmd, 'mode', args.shift(), 0, 8);

  if (mode === null) {
    return Promise.resolve();
  }

  const attrs = {
    'flags': FileXferAttrs.PERMISSIONS,
    'permissions': mode,
  };

  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    return this.client.setFileStatus(this.makePath_(path), attrs);
  }), Promise.resolve());
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<?Cli.Completion>} Possible completions.
 */
Cli.completeChmod_ = async function(args) {
  // Only complete the paths.
  if (args.length > 2) {
    return this.completeResolvedRemotePath_(args);
  }
  return null;
};
Cli.addCommand_(['chmod'], 2, null, '', '<mode> <paths...>',
                Cli.commandChmod_, Cli.completeChmod_);

/**
 * User command to change user/group ownership.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandChown_ = function(args) {
  const account = this.parseInt_(args.cmd, 'account', args.shift());

  if (account === null) {
    return Promise.resolve();
  }

  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    return this.client.fileStatus(this.makePath_(path))
      .then((attrs) => {
        // Need the lib.notNull again as closure compiler is unable to handle
        // the check above for some reason.
        const /** @type {!FileAttrs} */ newAttrs = {
          'flags': FileXferAttrs.UIDGID,
          'uid': args.cmd === 'chown' ? lib.notNull(account) : attrs.uid,
          'gid': args.cmd !== 'chown' ? lib.notNull(account) : attrs.gid,
        };
        return this.client.setFileStatus(this.makePath_(path), newAttrs);
      });
  }), Promise.resolve());
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<?Cli.Completion>} Possible completions.
 */
Cli.completeChown_ = async function(args) {
  // Only complete the paths.
  if (args.length > 2) {
    return this.completeResolvedRemotePath_(args);
  }
  return null;
};
Cli.addCommand_(['chgrp', 'chown'], 2, null, '', '<account> <paths...>',
                Cli.commandChown_, Cli.completeChown_);

/**
 * User command to clear the screen.
 *
 * @this {Cli}
 * @param {!Array<string>} _args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandClear_ = function(_args) {
  this.terminal.clearHome();
  return Promise.resolve();
};
Cli.addCommand_(['clear'], 0, 0, '', '',
                Cli.commandClear_);

/**
 * User command to copy a file to the clipboard.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandClip_ = function(args) {
  const path = args.shift();
  const offset = this.parseInt_(args.cmd, 'offset', args.shift());
  const length = this.parseInt_(args.cmd, 'length', args.shift(),
                                10 * 1024 * 1024);

  if (length === null || offset === null) {
    return Promise.resolve();
  }

  const spinner = new ProgressBar(this.terminal);
  spinner.update();

  const chunks = [];
  const handleChunk = (chunk) => {
    if (this.userInterrupted_) {
      return false;
    }

    spinner.update();
    chunks.push(chunk);
  };

  return this.client.readFile(this.makePath_(path), handleChunk, offset, length)
    .then(() => (new Blob(chunks)).text())
    .then((string) => {
      this.io.println(localize('NASFTP_CMD_CLIP_SUMMARY', [string.length]));
      this.terminal.copyStringToClipboard(string);
    });
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<?Cli.Completion>} Possible completions.
 */
Cli.completeClip_ = async function(args) {
  // Only complete the first argument.
  if (args.length <= 2) {
    return this.completeResolvedRemotePath_(args);
  }
  return null;
};
Cli.addCommand_(['clip', 'clipboard'], 1, 3, '',
                       '<path> [offset] [length]',
                Cli.commandClip_, Cli.completeClip_);

/**
 * User command to toggle color support.
 *
 * @this {Cli}
 * @param {!Array<string>} _args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandColor_ = async function(_args) {
  this.toggleColors_();
  this.prefs_.set('color', !!this.colorMap_['prompt']);
};
Cli.addCommand_(['color'], 0, 0, '', '',
                Cli.commandColor_);

/**
 * User command to copy files.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandCopy_ = function(args) {
  const src = this.makePath_(args.shift());
  const dst = this.makePath_(args.shift());

  if (this.client.protocolServerExtensions['copy-data'] === undefined) {
    this.showError_(localize(
        'NASFTP_ERROR_MISSING_PROTOCOL_EXTENSION', [args.cmd, 'copy-data']));
    return Promise.resolve();
  }

  // Make sure the source file exists.
  return this.client.fileStatus(src)
    .then((attrs) => {
      // Only copy regular files.
      if (attrs.isRegularFile !== true) {
        this.showError_(localize(
            'NASFTP_ERROR_NON_REG_FILE', [args.cmd, src]));
        return;
      }

      // Open the source file for reading.
      let readHandle;
      return this.client.openFile(src, OpenFlags.READ)
        .then((handle) => {
          readHandle = handle;

          const flags = OpenFlags.WRITE | OpenFlags.CREAT | OpenFlags.TRUNC;

          // Open the destination file for writing.
          let writeHandle;
          return this.client.openFile(dst, flags)
            .then((handle) => {
              writeHandle = handle;

              // Send the copy-data request.
              return this.client.copyData(readHandle, writeHandle, attrs.size);
            })
            .finally(() => {
              if (writeHandle !== undefined) {
                return this.client.closeFile(writeHandle);
              }
            });
        })
        .finally(() => {
          if (readHandle !== undefined) {
            return this.client.closeFile(readHandle);
          }
        });
    });
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<?Cli.Completion>} Possible completions.
 */
Cli.completeCopy_ = async function(args) {
  // Only complete the paths.
  if (args.length <= 3) {
    return this.completeResolvedRemotePath_(args);
  }
  return null;
};
Cli.addCommand_(['copy', 'cp'], 2, 2, '', '<src> <dst>',
                Cli.commandCopy_, Cli.completeCopy_);

/**
 * User command to get filesystem information.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @param {!Object} opts The set of seen options.
 * @return {!Promise<void>}
 */
Cli.commandDiskFree_ = function(args, opts) {
  // Translate short options into something more readable.
  opts.human = opts.h;
  opts.inode = opts.i;

  // If no args, default to the cwd.
  if (args.length == 0) {
    args.unshift('');
  }

  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    const fullpath = this.makePath_(path);
    return this.client.statvfs(fullpath)
      .then((st) => {
        let total;
        let used;
        let uavail;
        let ravail;
        let percent;
        if (opts.inode) {
          // Display inode statistics.
          total = st.files;
          used = st.files - st.ffree;
          uavail = st.favail;
          ravail = st.ffree;
          percent = used / total;
        } else if (opts.human) {
          // Display human byte sizes.
          const fmt = Cli.format_;
          total = fmt(st.frsize * st.blocks);
          used = fmt(st.frsize * (st.blocks - st.bfree));
          uavail = fmt(st.frsize * st.bavail);
          ravail = fmt(st.frsize * st.bfree);
          percent = (st.blocks - st.bfree) / st.blocks;
        } else {
          // Display kilobyte sizes.
          total = Math.floor(st.frsize * st.blocks / 1024);
          used = Math.floor(st.frsize * (st.blocks - st.bfree) / 1024);
          uavail = Math.floor(st.frsize * st.bavail / 1024);
          ravail = Math.floor(st.frsize * st.bfree / 1024);
          percent = (st.blocks - st.bfree) / st.blocks;
        }
        this.io.println(localize('NASFTP_CMD_DF_SUMMARY', [
          this.escapeString_(fullpath),
          `${st.fsid_hi.toString(16)}${st.fsid_lo.toString(16)}`,
          total,
          used,
          Math.round(100 * percent),
          uavail,
          ravail,
        ]));
      });
  }), Promise.resolve());
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<!Cli.Completion>} Possible completions.
 */
Cli.completeDiskFree_ = async function(args) {
  return this.completeResolvedRemotePath_(args);
};
Cli.addCommand_(['df'], 0, null, 'hi', '[paths...]',
                Cli.commandDiskFree_, Cli.completeDiskFree_);

/**
 * User command to download a single file.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @param {!Object} opts The set of seen options.
 * @return {!Promise<void>}
 */
Cli.commandGet_ = async function(args, opts) {
  opts.resume = opts.a || args.cmd === 'reget';

  const src = args.shift();
  const dst = args.length == 0 ? this.basename(src) : args.shift();

  this.io.println(localize('NASFTP_CMD_GET_DOWNLOAD_FILE', [
    this.escapeString_(src),
    this.escapeString_(dst),
  ]));

  let writer;
  let spinner;
  let offset = 0;
  const handleChunk = (chunk) => {
    if (this.userInterrupted_) {
      return false;
    }

    offset += chunk.length;
    spinner.update(offset);
    return writer.write(chunk);
  };

  return this.client.fileStatus(this.makePath_(src))
    .then(async (attrs) => {
      spinner = new ProgressBar(this.terminal, attrs.size);
      writer = getFileWriter(dst, attrs, {
        document: this.terminal.getDocument(),
        window: globalThis,
        cli: this,
        prefs: this.localPrefs_,
      });
      return writer.init(opts.resume).then((offset) => {
        return this.client.readFile(this.makePath_(src), handleChunk, offset);
      }).then(() => spinner.finish(true))
        .catch((e) => {
          spinner.finish(false);
          if (e instanceof DOMException && e.code === DOMException.ABORT_ERR) {
            // User canceled things.  This is not an error.
            if (writer instanceof FileSystemApiFileWriter) {
              this.io.println(localize('NASFTP_TIP_FILE_WRTIER_API_PREF', [
                `${localize('NASFTP_CMD_PREFERENCES')} downloadMode a`,
              ]));
            }
          } else {
            throw e;
          }
        })
        .finally(() => writer.close());
    });
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<?Cli.Completion>} Possible completions.
 */
Cli.completeGet_ = async function(args) {
  // Only complete the first argument.
  if (args.length <= 2 || (args.length === 3 && args[1] === '-a')) {
    return this.completeResolvedRemotePath_(args);
  }
  return null;
};
Cli.addCommand_(['get', 'reget'], 1, 2, 'a', '<remote name> [local name]',
                Cli.commandGet_, Cli.completeGet_);

/**
 * User command to show help for registered commands.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandHelp_ = function(args) {
  const lhs = (command) => {
    return localize('NASFTP_CMD_HELP_LHS', [command.command, command.usage]);
  };
  let pad = 0;

  // If the user didn't request specific commands, show all of them.
  if (args.length == 0) {
    args = Object.keys(this.commands_);
  }

  // Calculate the length of commands to align the final output.
  for (const command of args) {
    if (!this.commands_.hasOwnProperty(command)) {
      this.showError_(localize('NASFTP_ERROR_UNKNOWN_CMD', [command]));
      return Promise.resolve();
    }

    const obj = this.commands_[command];
    pad = Math.max(pad, lhs(obj).length);
  }

  // Display each command now.
  for (const command of args) {
    // Omit internal commands.
    if (command.startsWith('_')) {
      continue;
    }

    const obj = this.commands_[command];
    this.io.println(localize('NASFTP_CMD_HELP_LINE', [
      lhs(obj).padEnd(pad), obj.help,
    ]));
  }

  return Promise.resolve();
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<!Cli.Completion>} Possible completions.
 */
Cli.completeHelp_ = async function(args) {
  const input = args[args.length - 1];
  return this.completeCommand_(input);
};
Cli.addCommand_(['help', '?'], 0, null, '', '[commands]',
                Cli.commandHelp_, Cli.completeHelp_);

/**
 * User command to manage command line history.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @param {!Object} opts The set of seen options.
 * @return {!Promise<void>}
 */
Cli.commandHistory_ = async function(args, opts) {
  if (opts.c) {
    this.history_.length = 0;
    await this.localPrefs_.reset('history');
    return;
  }

  const len = this.history_.length;
  for (let i = 0; i < len; ++i) {
    this.io.println(`${i + 1}  ${this.history_[len - i - 1]}`);
  }
};
Cli.addCommand_(['history'], 0, 0, 'c', '',
                Cli.commandHistory_);

/**
 * User command to change the local working directory.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandLcd_ = async function(args) {
  if (globalThis.showDirectoryPicker === undefined) {
    this.showError_(localize('NASFTP_ERROR_MISSING_FILE_SYSTEM_ACCESS_API'));
    return;
  }

  try {
    this.lcwd = await globalThis.showDirectoryPicker({
      id: 'lcd',
      mode: 'readwrite',
      startIn: 'downloads',
    });
  } catch (e) {
    if (e instanceof DOMException && e.code === DOMException.ABORT_ERR) {
      // User canceled picker action.  This is not an error, so ignore it.
    } else {
      this.showError_(localize('NASFTP_ERROR_PERMISSION_DENIED', [args.cmd]));
    }
  }
};
Cli.addCommand_(['lchdir', 'lcd'], 0, 0, '', '',
                Cli.commandLcd_);

/**
 * User command to list information about files/directories.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @param {!Object} opts The set of seen options.
 * @return {!Promise<void>}
 */
Cli.commandList_ = function(args, opts) {
  // Translate short options into something more readable.
  opts.all = opts.a;
  opts.long = opts.l;
  opts.one = opts['1'];
  opts.reverse = opts.r;
  opts.recursive = opts.R;
  opts.sort = !opts.f || opts.S || opts.t;
  opts.size = opts.S;
  opts.time = opts.t;

  // If no args, default to the cwd.
  if (args.length == 0) {
    args.unshift('');
  }

  const spinner = new ProgressBar(this.terminal);
  spinner.update();

  // List this directory.
  const listDir = (path, printHeader) => {
    if (this.userInterrupted_) {
      return;
    }

    if (printHeader) {
      this.rawprintln_(`${path}:`);
    }

    return this.client.openDirectory(path)
      .then((handle) => {
        // Enumerate all the entries in this path.
        spinner.update();

        return this.client.scanDirectory(handle, (_entry) => {
          spinner.update();
          if (this.userInterrupted_) {
            return;
          }

          return true;
        })
        .finally(() => this.client.closeFile(handle));
      })
      .catch((response) => {
        if (response instanceof StatusError) {
          // Maybe they tried to list a file.  Synthesize a result.
          if (response.code == StatusCodes.NO_SUCH_FILE) {
            return this.client.linkStatus(path)
              .then((attrs) => {
                const basename = this.basename(path);
                const mode = bitsToUnixModeLine(attrs.permissions);
                const date = epochToLocal(attrs.lastModified);
                const longFilename =
                    `${mode}  ${attrs.uid} ${attrs.gid}  ${attrs.size}  ` +
                    `${date.toDateString()}  ${basename}`;
                return [Object.assign({
                  filename: basename,
                  longFilename: longFilename,
                }, attrs)];
              });
          }
        }
        throw response;
      })
      .then((entries) => {
        spinner.update();
        if (this.userInterrupted_) {
          return;
        }

        // Sort the entries based on the user settings.
        if (opts.sort) {
          const less = opts.reverse ? -1 : 1;
          const more = opts.reverse ? 1 : -1;
          let sort;
          if (opts.size) {
            sort = (a, b) => a.size < b.size ? less : more;
          } else if (opts.time) {
            sort = (a, b) => a.lastModified < b.lastModified ? less : more;
          } else {
            sort = (a, b) => a.filename > b.filename ? less : more;
          }
          entries.sort(sort);
        }

        // Display all the entries.
        if (opts.long || opts.one) {
          // One entry per line.
          entries.forEach((file) => {
            if (opts.all || !file.filename.startsWith('.')) {
              this.rawprintln_(opts.long ? file.longFilename : file.filename);
            }
          });
        } else {
          // Pack multiple entries per line.
          let minWidth = 10;
          entries.forEach((file) => {
            if (opts.all || !file.filename.startsWith('.')) {
              // We +1 for trailing / and another +1 for trailing space.
              minWidth = Math.max(minWidth, file.filename.length + 2);
            }
          });
          const perLine = Math.max(
              Math.floor(this.io.terminal_.screenSize.width / minWidth) - 1, 1);
          let cnt = 0;
          entries.forEach((entry) => {
            let filename = entry.filename;
            if (opts.all || !filename.startsWith('.')) {
              const color = this.getColorForAttrs_(entry);
              if (color) {
                this.io.print(color);
              }
              if (entry.isDirectory) {
                filename += '/';
              }
              this.rawprint_(filename);
              if (color) {
                this.io.print(this.colorMap_['reset']);
              }
              this.io.print(' '.repeat(minWidth - filename.length));

              if (++cnt == perLine) {
                this.io.println('');
                cnt = 0;
              }
            }
          });
          if (cnt) {
            this.io.println('');
          }
        }

        // In recursive mode, show all the dirs we found here.
        if (opts.recursive) {
          // Strip off trailing / if it exists so we can add it below.
          path = path.replace(/\/+$/, '');

          // Create a chain of promises by processing each dir in serial.
          return entries.reduce((chain, entry) => chain.then(() => {
            if (this.userInterrupted_) {
              return;
            }

            // Skip filtered paths.
            const filename = entry.filename;
            if (filename != '.' && filename != '..') {
              if (opts.all || !filename.startsWith('.')) {
                if (entry.isDirectory) {
                  this.io.println(' ');
                  return listDir(`${path}/${entry.filename}`, true);
                }
              }
            }
          }), Promise.resolve());
        }
      });
  };

  // Create a chain of promises by processing each path in serial.
  let first = true;
  return args.reduce((chain, path) => chain.then(() => {
    if (this.userInterrupted_) {
      return;
    }

    // When showing more than one path, add a padding line.
    if (!first) {
      this.io.println(' ');
    } else {
      first = false;
    }

    return listDir(this.makePath_(path), opts.recursive || args.length > 1);
  }), Promise.resolve());
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<!Cli.Completion>} Possible completions.
 */
Cli.completeList_ = async function(args) {
  return this.completeResolvedRemotePath_(args);
};
Cli.addCommand_(['list', 'ls', 'dir'], 0, null, '1aflrRSt', '[dirs...]',
                Cli.commandList_, Cli.completeList_);

/**
 * User command to list information about local files/directories.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandLocalList_ = async function(args) {
  if (this.lcwd === null) {
    return;
  }

  // TODO(vapier): Unify with `ls` command for sorting/coloring/etc...
  const paths = [];
  for await (const key of this.lcwd.keys()) {
    paths.push(key);
  }
  paths.sort();
  paths.map((path) => this.io.println(path));
};
Cli.addCommand_(['llist', 'lls', 'ldir'], 0, 0, '', '',
                Cli.commandLocalList_);

/**
 * User command to create hardlinks & symlinks.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @param {!Object} opts The set of seen options.
 * @return {!Promise<void>}
 */
Cli.commandLink_ = function(args, opts) {
  // Translate short options into something more readable.
  opts.symlink = opts.s;

  const target = args.shift();
  const path = args.shift();
  const func = opts.symlink ? 'symLink' : 'hardLink';
  return this.client[func](this.makePath_(target), this.makePath_(path));
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<?Cli.Completion>} Possible completions.
 */
Cli.completeLink_ = async function(args) {
  // Only complete the paths.
  if (args.length <= 3) {
    return this.completeResolvedRemotePath_(args);
  }
  return null;
};
Cli.addCommand_(['ln'], 2, 2, 's', '<target> <path>',
                Cli.commandLink_, Cli.completeLink_);

/**
 * User command to show the active local working directory.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandLpwd_ = async function(args) {
  this.io.println(localize('NASFTP_CMD_LPWD_OUTPUT', [
    this.escapeString_(this.lcwd?.name ?? ''),
  ]));
};
Cli.addCommand_(['lpwd'], 0, 0, '', '',
                Cli.commandLpwd_);

/**
 * User command to download multiple files.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @param {!Object} opts The set of seen options.
 * @return {!Promise<void>}
 */
Cli.commandMget_ = async function(args, opts) {
  opts.resume = opts.a || args.cmd === 'mreget';

  // Construct base command for chaining.
  const basecmd = [args.cmd.slice(1)];
  if (opts.resume) {
    basecmd.push('-a');
  }

  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    // Pretend the user typed in 'get' for each file.
    return this.dispatchCommand_([...basecmd, path]);
  }), Promise.resolve());
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<?Cli.Completion>} Possible completions.
 */
Cli.completeMget_ = async function(args) {
  return this.completeResolvedRemotePath_(args);
};
Cli.addCommand_(['mget', 'mreget'], 1, null, 'a', '<remote paths...>',
                Cli.commandMget_, Cli.completeMget_);

/**
 * User command to create directories.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandMkdir_ = function(args) {
  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    return this.client.makeDirectory(this.makePath_(path));
  }), Promise.resolve());
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<!Cli.Completion>} Possible completions.
 */
Cli.completeMkdir_ = async function(args) {
  // Can't mkdir files, so only allow completing (through) dirs.
  return this.completeResolvedRemotePath_(args, true);
};
Cli.addCommand_(['mkdir'], 1, null, '', '<paths...>',
                Cli.commandMkdir_, Cli.completeMkdir_);

/**
 * User command to rename paths.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandMove_ = function(args) {
  const src = args.shift();
  const dst = args.shift();
  return this.client.renameFile(this.makePath_(src), this.makePath_(dst))
    .then(() => {});
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<?Cli.Completion>} Possible completions.
 */
Cli.completeMove_ = async function(args) {
  // Only complete the paths.
  if (args.length <= 3) {
    return this.completeResolvedRemotePath_(args);
  }
  return null;
};
Cli.addCommand_(['move', 'mv', 'ren', 'rename'], 2, 2, '', '<src> <dst>',
                Cli.commandMove_, Cli.completeMove_);

/**
 * User command to upload multiple files.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @param {!Object} opts The set of seen options.
 * @return {!Promise<void>}
 */
Cli.commandMput_ = async function(args, opts) {
  opts.resume = opts.a || args.cmd === 'mreput';
  opts.fsync = opts.f;

  // Construct base command for chaining.
  const basecmd = [args.cmd.slice(1)];
  if (opts.resume) {
    basecmd.push('-a');
  }
  if (opts.fsync) {
    basecmd.push('-f');
  }

  // Pretend the user typed in 'put' without any arguments.
  // This command is basically a forced alias to 'put' for people who don't
  // immediately realize that 'put' already supports multiple files, and for
  // people used to OpenSSH sftp that has a dedicated mput command.
  return this.dispatchCommand_(basecmd);
};
Cli.addCommand_(['mput', 'mreput'], 0, 0, 'af', '',
                Cli.commandMput_);

/**
 * The set of known preferences the user may interact with.
 */
const knownUserPreferences = new Set([
  'downloadMode',
]);

/**
 * User command to control various preferences.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @param {!Object} opts The set of seen options.
 * @return {!Promise<void>}
 */
Cli.commandPreferences_ = async function(args, opts) {
  opts.unset = opts.u;

  if (args.length === 0) {
    if (opts.unset) {
      // Reset all preferences.
      knownUserPreferences.forEach((key) => {
        this.localPrefs_.reset(key);
      });
    } else {
      // Show current preferences.
      Array.from(knownUserPreferences).sort().forEach((key) => {
        const value = this.localPrefs_.get(key);
        this.io.println(localize('NASFTP_CMD_PREFERENCES_LINE', [key, value]));
      });
    }
    return;
  }

  const key = args.shift();
  if (!knownUserPreferences.has(key)) {
    this.showError_(localize('NASFTP_ERROR_UNKNOWN_ARGUMENT', [args.cmd, key]));
    return;
  }

  if (opts.unset) {
    // Unset the preference.
    if (args.length !== 0) {
      this.showError_(localize('NASFTP_ERROR_TOO_MANY_ARGS', [args.cmd]));
      return;
    }

    this.localPrefs_.reset(key);
  } else {
    // Set the preference.
    if (args.length === 0) {
      this.showError_(localize('NASFTP_ERROR_NOT_ENOUGH_ARGS', [args.cmd]));
      return;
    } else if (args.length !== 1) {
      this.showError_(localize('NASFTP_ERROR_TOO_MANY_ARGS', [args.cmd]));
      return;
    }

    let value = args.shift();
    if (value === 'null') {
      value = null;
    }
    this.localPrefs_.set(key, value);
  }
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<?Cli.Completion>} Possible completions.
 */
Cli.completePreferences_ = async function(args) {
  const key = args[1];
  const value = args[2];

  if (args.length === 2) {
    // Complete the preference name.
    const matches = [];
    knownUserPreferences.forEach((pref) => {
      if (pref.startsWith(key)) {
        matches.push(pref);
      }
    });
    return /** @type {!Cli.Completion} */ ({arg: key, matches});
  } else if (args.length === 3) {
    // Complete the preference value.
    let values = [];
    switch (key) {
      case 'downloadMode':
        values = ['null', 'a', 'fsapi'];
        break;
    }

    const matches = [];
    values.forEach((v) => {
      if (v.startsWith(value)) {
        matches.push(v);
      }
    });
    return /** @type {!Cli.Completion} */ ({arg: value, matches});
  }
  return null;
};
Cli.addCommand_(['preferences', 'cfg', 'config'], 0, 2, 'u', '[key] [value]',
                Cli.commandPreferences_, Cli.completePreferences_);

/**
 * User command to control the prompt.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandPrompt_ = async function(args) {
  if (args.length) {
    this.prompt_ = args.shift();
  } else {
    if (this.prompt_ === null) {
      this.prompt_ = '';
    } else {
      this.prompt_ = null;
    }
  }

  await this.prefs_.set('prompt', this.prompt_);
};
Cli.addCommand_(['prompt'], 0, 1, '', '[prompt]',
                Cli.commandPrompt_);

/**
 * User command to upload files.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @param {!Object} opts The set of seen options.
 * @return {!Promise<void>}
 */
Cli.commandPut_ = function(args, opts) {
  // Translate short options into something more readable.
  opts.resume = opts.a || args.cmd === 'reput';
  opts.fsync = opts.f;

  const doc = this.terminal.getDocument();
  const input = doc.createElement('input');
  input.type = 'file';

  const dst = args.shift();
  input.multiple = dst === undefined;

  // Need to add to the DOM to process events properly.
  doc.body.appendChild(input);

  return new Promise((resolveAllFiles) => {
    // Detect user interrupts.  The WebAPI offers no way of detecting when the
    // user cancels the file selection dialog.  The best we can do is poll for
    // the user to interrupt things.
    let cancelPoller;
    const cancelCheck = () => {
      if (this.userInterrupted_) {
        resolveAllFiles();
      } else {
        cancelPoller = setTimeout(cancelCheck, 1000);
      }
    };
    cancelPoller = setTimeout(cancelCheck, 1000);

    // First promise waits for the user to select files to upload.
    input.addEventListener('change', () => {
      // Since the user has selected some files, we can stop polling.
      clearTimeout(cancelPoller);

      // Create a chain of promises by processing each path in serial.
      Object.values(input.files).reduce((chain, file) => chain.then(() => {
        // Check for interrupt between each file upload.
        if (this.userInterrupted_) {
          return;
        }

        // If the user specified a name, use it.
        const name = dst === undefined ? file.name : dst;

        this.io.println(localize('NASFTP_CMD_PUT_UPLOAD_FILE', [
          this.escapeString_(file.name),
          this.escapeString_(name),
          Cli.format_(file.size),
        ]));

        const spinner = new ProgressBar(this.terminal, file.size);

        // Next promise waits for the file to be processed (read+uploaded).
        return new Promise(async (resolveOneFile) => {
          const path = this.makePath_(name);
          let offset = 0;

          // Figure out whether to resume or clobber the file.
          let flags = OpenFlags.WRITE;
          let resume = opts.resume;
          if (resume) {
            try {
              const attrs = await this.client.fileStatus(path);
              offset = attrs.size;
              flags |= OpenFlags.APPEND;
            } catch (e) {
              // File doesn't exist, so disable resuming.
              if (e instanceof StatusError) {
                resume = false;
              } else {
                throw e;
              }
            }
          }
          if (!resume) {
            flags |= OpenFlags.CREAT | OpenFlags.TRUNC;
          }

          // Start by opening the remote path.
          let openHandle;
          return this.client.openFile(path, flags)
            .then((handle) => {
              openHandle = handle;

              const readThenWrite = () => {
                spinner.update(offset);
                if (this.userInterrupted_) {
                  return;
                }

                // We use chunk sizes that match the SFTP write chunk size to
                // avoid any further fragmentation.
                const chunk = file.slice(
                    offset, offset + this.client.writeChunkSize);
                if (chunk.size == 0) {
                  return;
                }

                return chunk.arrayBuffer()
                  .then((result) => {
                    return this.client.writeChunk(handle, offset, result);
                  })
                  .then(() => {
                    offset += chunk.size;
                    return readThenWrite();
                  });
              };

              return readThenWrite();
            })
            .then(() => {
              if (opts.fsync) {
                return this.client.fsync(openHandle);
              }
            })
            .finally(() => {
              if (openHandle !== undefined) {
                return this.client.closeFile(openHandle);
              }
            })
            .then(() => {
              resolveOneFile();
              spinner.finish(true);
            });
        });
      }), Promise.resolve()).then(resolveAllFiles);
    });

    // Trigger the file selection dialog.
    input.click();
  })
  .finally(() => doc.body.removeChild(input));
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<?Cli.Completion>} Possible completions.
 */
Cli.completePut_ = async function(args) {
  // Only complete the first argument.
  if (args.length <= 2) {
    return this.completeResolvedRemotePath_(args);
  }
  return null;
};
Cli.addCommand_(['put', 'reput'], 0, 1, 'af', '[remote name]',
                Cli.commandPut_, Cli.completePut_);

/**
 * User command to show the active working directory.
 *
 * @this {Cli}
 * @param {!Array<string>} _args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandPwd_ = function(_args) {
  this.io.println(localize('NASFTP_CMD_PWD_OUTPUT', [
    this.escapeString_(this.cwd),
  ]));
  return Promise.resolve();
};
Cli.addCommand_(['pwd'], 0, 0, '', '',
                Cli.commandPwd_);

/**
 * User command to quit the session.
 *
 * @this {Cli}
 * @param {!Array<string>} _args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandQuit_ = function(_args) {
  this.terminal.keyboard.bindings.clear();
  this.commandInstance_.exit(0, /* noReconnect= */ false);
  return Promise.resolve();
};
Cli.addCommand_(['exit', 'quit', 'bye'], 0, 0, '', '',
                Cli.commandQuit_);

/**
 * User command to read a symlink.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandReadlink_ = function(args) {
  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    return this.client.readLink(this.makePath_(path))
      .then((entries) => {
        // There should be only one result, but who knows!
        entries.files.forEach((file) => this.rawprintln_(file.filename));
      });
  }), Promise.resolve());
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<!Cli.Completion>} Possible completions.
 */
Cli.completeReadlink_ = async function(args) {
  return this.completeResolvedRemotePath_(args);
};
Cli.addCommand_(['readlink'], 1, null, '', '<paths...>',
                Cli.commandReadlink_, Cli.completeReadlink_);

/**
 * User command to resolve a path remotely.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandRealpath_ = function(args) {
  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    return this.client.realPath(this.makePath_(path))
      .then((entries) => {
        // There should be only one result, but who knows!
        entries.files.forEach((file) => this.rawprintln_(file.filename));
      });
  }), Promise.resolve());
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<!Cli.Completion>} Possible completions.
 */
Cli.completeRealpath_ = async function(args) {
  return this.completeResolvedRemotePath_(args);
};
Cli.addCommand_(['realpath'], 1, null, '', '<paths...>',
                Cli.commandRealpath_, Cli.completeRealpath_);

/**
 * User command to remove files.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @param {!Object} opts The set of seen options.
 * @return {!Promise<void>}
 */
Cli.commandRemove_ = function(args, opts) {
  // Translate short options into something more readable.
  opts.force = opts.f;
  opts.recursive = opts.r || opts.R;
  opts.verbose = opts.v;

  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    path = this.makePath_(path);
    if (opts.verbose) {
      this.rawprintln_(path);
    }
    return (opts.recursive ?
        this.client.removeDirectory(path, true) :
        this.client.removeFile(path))
      .catch((e) => {
        // If the file is missing or permission denied or something, ignore the
        // error when using f.  Don't swallow any other errors though (like test
        // failures).
        if (e instanceof StatusError) {
          if (!opts.force) {
            throw e;
          }
        }
      });
  }), Promise.resolve());
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<!Cli.Completion>} Possible completions.
 */
Cli.completeRemove_ = async function(args) {
  return this.completeResolvedRemotePath_(args);
};
Cli.addCommand_(['rm', 'del'], 1, null, 'rRfv', '<paths...>',
                Cli.commandRemove_, Cli.completeRemove_);

/**
 * User command to remove directories.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandRmdir_ = function(args) {
  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    return this.client.removeDirectory(this.makePath_(path));
  }), Promise.resolve());
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<!Cli.Completion>} Possible completions.
 */
Cli.completeRmdir_ = async function(args) {
  // Can't rmdir files, so only allow dirs.
  return this.completeResolvedRemotePath_(args, true);
};
Cli.addCommand_(['rmdir'], 1, null, '', '<paths...>',
                Cli.commandRmdir_, Cli.completeRmdir_);

/**
 * User command to show images.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandShow_ = function(args) {
  // Create a chain of promises by processing each path in serial.
  const spinner = new ProgressBar(this.terminal);
  spinner.update();
  return args.reduce((chain, path) => chain.then(() => {
    const chunks = [];
    const handleChunk = (chunk) => {
      if (this.userInterrupted_) {
        return false;
      }

      spinner.update();
      chunks.push(chunk);
    };
    return this.client.readFile(this.makePath_(path), handleChunk)
      .then(() => {
        spinner.finish();
        this.terminal.displayImage({
          inline: true,
          name: path,
          blob: new Blob(chunks),
        });
      });
  }), Promise.resolve());
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<!Cli.Completion>} Possible completions.
 */
Cli.completeShow_ = async function(args) {
  return this.completeResolvedRemotePath_(args);
};
Cli.addCommand_(['show'], 1, null, '', '<paths...>',
                Cli.commandShow_, Cli.completeShow_);

/**
 * User command to show path status/details.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandStat_ = function(args) {
  const func = args.cmd == 'stat' ? 'fileStatus' : 'linkStatus';

  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    return this.client[func](this.makePath_(path))
      .then((attrs) => {
        this.io.println(localize('NASFTP_CMD_STAT_SUMMARY', [
          this.escapeString_(path),
          attrs.size,
          attrs.uid,
          attrs.gid,
          `0${lib.f.zpad(attrs.permissions.toString(8), 7)} ` +
          `(${bitsToUnixModeLine(attrs.permissions)})`,
          `${attrs.lastAccessed} (` +
          `${epochToLocal(attrs.lastAccessed)})`,
          `${attrs.lastModified} (` +
          `${epochToLocal(attrs.lastModified)})`,
        ]));
        if (attrs.extensions) {
          this.io.println(localize('NASFTP_CMD_STAT_EXTENSIONS_HEADER'));
          attrs.extensions.forEach((ele) => {
            this.io.println(localize('NASFTP_CMD_STAT_EXTENSIONS_LINE', [
              this.escapeString_(ele.type),
              this.escapeString_(ele.data),
            ]));
          });
        }
      });
  }), Promise.resolve());
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<!Cli.Completion>} Possible completions.
 */
Cli.completeStat_ = async function(args) {
  return this.completeResolvedRemotePath_(args);
};
Cli.addCommand_(['stat', 'lstat'], 1, null, '', '<paths...>',
                Cli.commandStat_, Cli.completeStat_);

/**
 * User command to touch files.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @param {!Object} opts The set of seen options.
 * @return {!Promise<void>}
 */
Cli.commandTouch_ = function(args, opts) {
  const flags = (opts.c ? 0 : OpenFlags.CREAT) | OpenFlags.WRITE;
  const date = Math.trunc(Date.now() / 1e3);
  const attrs = {
    flags: FileXferAttrs.ACMODTIME,
    lastAccessed: date,
    lastModified: date,
  };

  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    // Final promise series sends open+set+close packets.
    let writeHandle;
    return this.client.openFile(this.makePath_(path), flags)
      .then((handle) => {
        writeHandle = handle;
        return this.client.setFileHandleStatus(handle, attrs);
      })
      .finally(() => {
        if (writeHandle !== undefined) {
          return this.client.closeFile(writeHandle);
        }
      });
  }), Promise.resolve());
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<?Cli.Completion>} Possible completions.
 */
Cli.completeTouch_ = async function(args) {
  return this.completeResolvedRemotePath_(args);
};
Cli.addCommand_(['touch'], 1, null, 'c', '<paths...>',
                Cli.commandTouch_, Cli.completeTouch_);

/**
 * User command to truncate files.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @param {!Object} opts The set of seen options.
 * @return {!Promise<void>}
 */
Cli.commandTruncate_ = function(args, opts) {
  // Peel off the first positional argument if using the -s option.
  let size = 0;
  if (opts.s) {
    size = this.parseInt_(args.cmd, 'size', args.shift());
  }

  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    // Clobber whatever file might already exist.
    const flags = OpenFlags.CREAT |
      (size ? OpenFlags.WRITE : OpenFlags.TRUNC);

    // Final promise series sends open(trunc)+close packets.
    let writeHandle;
    return this.client.openFile(this.makePath_(path), flags)
      .then((handle) => {
        writeHandle = handle;

        // If truncating to a specific non-zero size, set the file size here.
        // Otherwise, the open itself truncated down to 0 bytes already.
        if (size) {
          const attrs = {
            flags: FileXferAttrs.SIZE,
            size,
          };
          return this.client.setFileHandleStatus(handle, attrs);
        }
      })
      .finally(() => {
        if (writeHandle !== undefined) {
          return this.client.closeFile(writeHandle);
        }
      });
  }), Promise.resolve());
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<!Cli.Completion>} Possible completions.
 */
Cli.completeTruncate_ = async function(args) {
  return this.completeResolvedRemotePath_(args);
};
Cli.addCommand_(['truncate'], 1, null, 's', '[-s <size>] <paths...>',
                Cli.commandTruncate_, Cli.completeTruncate_);

/**
 * User command to create symlinks.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandSymlink_ = function(args) {
  const target = args.shift();
  const path = args.shift();

  return this.client.symLink(this.makePath_(target), this.makePath_(path))
    .then(() => {});
};
/**
 * Complete the command.
 *
 * @this {Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<?Cli.Completion>} Possible completions.
 */
Cli.completeSymlink_ = async function(args) {
  // Only complete the paths.
  if (args.length <= 3) {
    return this.completeResolvedRemotePath_(args);
  }
  return null;
};
Cli.addCommand_(['symlink'], 2, 2, '', '<target> <path>',
                Cli.commandSymlink_, Cli.completeSymlink_);

/**
 * User command to show the active SFTP version.
 *
 * @this {Cli}
 * @param {!Array<string>} _args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandVersion_ = function(_args) {
  this.io.println(localize('NASFTP_CMD_VERSION_SUMMARY', [
    this.client.protocolClientVersion,
    this.client.protocolServerVersion,
  ]));
  this.io.println(localize('NASFTP_CMD_VERSION_EXTENSIONS_HEADER'));

  const names = Object.keys(this.client.protocolServerExtensions).sort();
  names.forEach((name) => {
    const data = this.client.protocolServerExtensions[name];
    this.io.println(localize('NASFTP_CMD_VERSION_EXTENSIONS_LINE', [
      name, data,
    ]));
  });

  return Promise.resolve();
};
Cli.addCommand_(['version'], 0, 0, '', '',
                Cli.commandVersion_);

/**
 * Run self tests.
 *
 * @this {Cli}
 * @param {!Array<string>} _args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandTestCli_ = function(_args) {
  const base = '/tmp/.nasftp-tests';
  this.io.println(`cli: starting test under ${base}`);

  // Wrapper for commands to provide good API.
  const wrap = (...argv) => {
    this.rawprintln_(`> ${argv.join(' ')}`);
    return this.dispatchCommand_(argv);
  };

  // Make sure some fields we tweak are saved & restored regardless of failures.
  const oldCwd = this.cwd;
  return wrap('version')
    .then(() => wrap('help'))
    .then(() => wrap('help', 'cd', 'version'))
    .then(() => wrap('help', 'xxxxxxx'))
    .then(() => wrap('color'))
    .then(() => wrap('color'))
    .then(() => wrap('preferences'))
    .then(() => wrap('chdir', '/tmp'))
    .then(() => wrap('rm', '-Rf', base))
    .then(() => wrap('mkdir', base))
    .then(() => wrap('list', base))
    .then(() => wrap('cd', base))
    .then(() => wrap('df'))
    .then(() => wrap('df', '-i', '.'))
    .then(() => wrap('df', '-h', '/'))
    .then(() => wrap('pwd'))
    .then(() => wrap('touch', 'touch'))
    .then(() => wrap('chmod', '750', '.'))
    .then(() => wrap('mkdir', 'subdir', 'subdir2', 'subdir3', 'emptydir'))
    .then(() => wrap('rmdir', 'emptydir'))
    .then(() => wrap('truncate', 'x', 'subdir/x1', 'subdir/üñïçödë'))
    .then(() => wrap('truncate', '-s', '10KB', 'x'))
    .then(() => wrap('ln', 'x', 'hard'))
    .then(() => wrap('ln', '-s', 'x', 'soft'))
    .then(() => wrap('symlink', 'x', 'sym'))
    .then(() => wrap('chmod', '600', 'x', 'sym'))
    .then(() => wrap('readlink', 'sym'))
    .then(() => wrap('lstat', '.', 'sym', 'soft', 'x'))
    .then(() => wrap('stat', '.', 'sym', 'hard', 'x', 'subdir/üñïçödë'))
    .then(() => wrap('cat', 'subdir/üñïçödë'))
    .then(() => wrap('cat', 'x', '0'))
    .then(() => wrap('cat', 'x', '10'))
    .then(() => wrap('cat', 'x', '10', '10'))
    .then(() => wrap('cat', '/dev/zero', '1', '10'))
    .then(() => wrap('clip', '/dev/urandom', '10', '10'))
    .then(() => wrap('clip', 'x'))
    .then(() => wrap('realpath', '.', 'sym', 'subdir'))
    .then(() => wrap('mv', 'x', 'xmv'))
    .then(() => wrap('rename', 'xmv', 'xren'))
    .then(() => wrap('move', 'xren', 'xmove'))
    .then(() => wrap('rm', '-v', 'xmove'))
    .then(() => wrap('ls', '-lrS'))
    .then(() => wrap('ls', '-1af', '.'))
    .then(() => wrap('ls', '-R', '', '.', 'subdir'))
    .then(() => wrap('dir', '-t', 'subdir'))
    .then(() => wrap('cd', '/tmp'))
    .then(() => wrap('rm', '-rf', base))
    // Make it clear we're all done.
    .then(() => this.io.println('cli: all tests passed!'))
    .finally(() => {
      this.cwd = oldCwd;
    });
};
Cli.addCommand_(['_run_test_cli'], 0, 0, '', '',
                Cli.commandTestCli_);

/**
 * Run live tests of the FSP code.
 *
 * @this {Cli}
 * @param {!Array<string>} _args The command arguments.
 * @return {!Promise<void>}
 */
Cli.commandTestFsp_ = function(_args) {
  // The actual test logic.
  const runTest = () => {
    const fsp = new SftpFsp();
    const fsid = 'fsid';
    const base = '/tmp/.nasftp-tests';
    const options = {fileSystemId: fsid};
    let opts;
    const newopts = (obj) => Object.assign(options, obj);

    // Initialize fsp state.
    fsp.addMount(fsid, {
      sftpClient: /** @type {!sftpClient} */ (this.client),
    });

    // Use smaller read/write sizes.  We just need to fragment requests.
    this.client.readChunkSize = 100;
    this.client.writeChunkSize = 200;

    // Helpers for displaying pass/fail status.
    const pass = (test, msg = '-') => this.rawprintln_(`PASS: ${test}: ${msg}`);
    const failed = (test, msg) => this.rawprintln_(`FAIL: ${test}: ${msg}`);

    /**
     * Wrapper for FSP functions to get a Promise based API.
     *
     * @param {function(!Object, function(...*), function(...*))} method
     *     The FSP API to test.
     * @param {!Object} opts
     * @return {!Promise<!Array<*>>}
     */
    const wrap = (method, opts) => new Promise((resolve, reject) => {
      method.call(
          fsp,
          opts,
          (...args) => {
            pass(method.name, args);
            resolve(...args);
          },
          (msg) => {
            failed(method.name, msg);
            reject();
          });
    });

    this.io.println(`fsp: starting test under ${base}`);
    return this.client.removeDirectory(base, true)
      .catch(() => {})

      // Initialize the base test tree.
      .then(() => {
        this.client.basePath_ = '/';
        opts = newopts({directoryPath: base});
        return wrap(fsp.onCreateDirectoryRequested, opts);
      })
      .then(() => {
        this.client.basePath_ = `${base}/`;
        opts = newopts({directoryPath: '/subdir'});
        return wrap(fsp.onCreateDirectoryRequested, opts);
      })
      .then(() => {
        opts = newopts({directoryPath: '/subdir/subdir'});
        return wrap(fsp.onCreateDirectoryRequested, opts);
      })

      // Symlink "sym" to "subdir".
      .then(() => this.client.symLink('subdir', '/sym'))
      // Copy "sym" to "newsym".
      .then(() => {
        opts = newopts({sourcePath: '/sym', targetPath: '/newsym'});
        return wrap(fsp.onCopyEntryRequested, opts);
      })
      // Delete the "sym" symlink.
      .then(() => {
        opts = newopts({entryPath: '/sym', recursive: true});
        return wrap(fsp.onDeleteEntryRequested, opts);
      })
      // Delete the "newsym" symlink.
      .then(() => {
        opts = newopts({entryPath: '/newsym', recursive: true});
        return wrap(fsp.onDeleteEntryRequested, opts);
      })
      // Verify "subdir" exists.
      .then(() => {
        opts = newopts({entryPath: '/subdir', name: true, isDirectory: true});
        return wrap(fsp.onGetMetadataRequested, opts);
      })

      // Create "x" file.
      .then(() => {
        opts = newopts({filePath: '/x'});
        return wrap(fsp.onTruncateRequested, opts);
      })
      // Rename "x" to "new".
      .then(() => {
        opts = newopts({sourcePath: '/x', targetPath: '/new'});
        return wrap(fsp.onMoveEntryRequested, opts);
      })
      // Symlink "sym" to "new".
      .then(() => this.client.symLink('new', '/sym'))
      // Delete the "sym" symlink.
      .then(() => {
        opts = newopts({entryPath: '/sym', recursive: false});
        return wrap(fsp.onDeleteEntryRequested, opts);
      })
      // Verify "new" exists.
      .then(() => {
        opts = newopts({entryPath: '/new', name: true, isDirectory: true});
        return wrap(fsp.onGetMetadataRequested, opts);
      })
      // Delete the "new" file.
      .then((_entries) => {
        opts = newopts({entryPath: '/new', recursive: false});
        return wrap(fsp.onDeleteEntryRequested, opts);
      })

      // Create the broken "brok" symlink, then delete it.
      .then(() => this.client.symLink('brok', '/brok'))
      .then(() => {
        opts = newopts({entryPath: '/brok', recursive: false});
        return wrap(fsp.onDeleteEntryRequested, opts);
      })

      // Create some files in subdirs for copying later.
      .then(() => {
        opts = newopts({filePath: '/subdir/x2'});
        return wrap(fsp.onTruncateRequested, opts);
      })
      .then(() => {
        opts = newopts({filePath: '/subdir/subdir/x3'});
        return wrap(fsp.onTruncateRequested, opts);
      })

      // Create the "file" file.
      .then(() => {
        opts = newopts({filePath: '/subdir/file', requestId: 'req'});
        return wrap(fsp.onCreateFileRequested, opts);
      })
      .then(() => {
        opts = newopts({openRequestId: 'req'});
        return wrap(fsp.onCloseFileRequested, opts);
      })

      // Write data to "file" file.
      .then(() => {
        opts = newopts({
          filePath: '/subdir/file',
          requestId: 'write',
          mode: 'WRITE',
        });
        return wrap(fsp.onOpenFileRequested, opts);
      })
      .then(() => {
        // Write out more data than a single write chunk can handle.
        const encoder = new TextEncoder();
        const data = 'abß1½3'.repeat(1000);
        opts = newopts({
          openRequestId: 'write',
          offset: 0,
          data: encoder.encode(data),
        });
        return wrap(fsp.onWriteFileRequested, opts);
      })
      .then(() => {
        opts = newopts({openRequestId: 'write'});
        return wrap(fsp.onCloseFileRequested, opts);
      })

      // Read data back from "file" file.
      .then(() => {
        opts = newopts({
          filePath: '/subdir/file',
          requestId: 'read',
          mode: 'READ',
        });
        return wrap(fsp.onOpenFileRequested, opts);
      })
      // Don't read the entire file, just a large segment in the middle.
      .then(() => {
        const offset = 1;
        const length = 500;
        opts = newopts({openRequestId: 'read', offset: offset, length: length});
        // Can't use wrap() helper because onSuccess is called multiple times.
        const method = fsp.onReadFileRequested.bind(fsp);
        const chunks = [];
        return new Promise((resolve, reject) => {
          method(
              opts,
              (data, hasMore) => {
                chunks.push(data);
                if (!hasMore) {
                  pass(method.name, chunks);
                  resolve([chunks, offset, length]);
                }
              },
              (msg) => {
                failed(method.name, msg);
                reject();
              });
        });
      })
      // Verify the data.
      .then(([chunks, offset, length]) => {
        // Turn the UTF-8 data into a JS string.
        const decoder = new TextDecoder();
        const data = chunks.reduce(
            (acc, chunk) => acc + decoder.decode(chunk, {stream: true}), '');

        // The length is in terms of UTF-8 codeunits, not characters.
        const encoder = new TextEncoder();
        const src = encoder.encode('abß1½3'.repeat(100));
        const exp = decoder.decode(src.subarray(offset, offset + length));

        if (data != exp) {
          failed('data corruption', data);
          return Promise.reject();
        }
      })
      .then(() => {
        opts = newopts({openRequestId: 'read'});
        return wrap(fsp.onCloseFileRequested, opts);
      })

      // Create some symlinks to read back later.
      .then(() => {
        return this.client.symLink('.', '/subdir/symdir')
          .then(() => this.client.symLink('brok', '/subdir/brok'))
          .then(() => this.client.symLink('file', '/subdir/symfile'));
      })

      // Copy the directory tree.
      .then(() => {
        opts = newopts({sourcePath: '/subdir', targetPath: '/newdir'});
        return wrap(fsp.onCopyEntryRequested, opts);
      })
      // Check the contents of the source tree.
      .then(() => {
        opts = newopts({entryPath: '/newdir/subdir/x3', name: true});
        return wrap(fsp.onGetMetadataRequested, opts);
      })
      .then(() => {
        opts = newopts({directoryPath: '/subdir'});
        return wrap(fsp.onReadDirectoryRequested, opts);
      })
      .then((entries) => {
        const names = entries.map((entry) => entry.name).sort();
        // Broken symlinks should be filtered.
        if (names[0] != 'file' || names[1] != 'subdir' || names[2] != 'symdir'
            || names[3] != 'symfile' || names[4] != 'x2') {
          failed('/subdir dir listing is incorrect', names);
          return Promise.reject();
        }
      })
      // Make sure the symlinks were copied as symlinks.
      .then(() => {
        opts = newopts({directoryPath: '/newdir'});
        return wrap(fsp.onReadDirectoryRequested, opts);
      })
      .then((entries) => {
        const names = entries.map((entry) => entry.name).sort();
        // Broken symlinks should be filtered from the read.
        if (names[0] != 'file' || names[1] != 'subdir' || names[2] != 'symdir'
            || names[3] != 'symfile' || names[4] != 'x2') {
          failed('/newdir dir listing is incorrect', names);
          return Promise.reject();
        }
      })
      .then(() => {
        return this.client.linkStatus('/newdir/symdir')
          .then((metadata) => {
            if (!metadata.isLink) {
              failed('/newdir/symdir is not a symlink', metadata);
              return Promise.reject();
            }
          });
      })
      .then(() => {
        return this.client.linkStatus('/newdir/symfile')
          .then((metadata) => {
            if (!metadata.isLink) {
              failed('/newdir/symfile is not a symlink', metadata);
              return Promise.reject();
            }
          });
      })
      // We should even copy broken symlinks.
      .then(() => {
        return this.client.linkStatus('/newdir/brok')
          .then((metadata) => {
            if (!metadata.isLink) {
              failed('/newdir/brok is not a symlink', metadata);
              return Promise.reject();
            }
          });
      })

      // Clean up the scratch dir.
      .then(() => {
        this.client.basePath_ = '/';
        opts = newopts({entryPath: base, recursive: true});
        return wrap(fsp.onDeleteEntryRequested, opts);
      })

      // Make it clear we're all done.
      .then(() => this.io.println('fsp: all tests passed!'));
  };

  // Make sure some fields we tweak are saved & restored regardless of failures.
  const oldBasePath = this.client.basePath_;
  const oldReadSize = this.client.readChunkSize;
  const oldWriteSize = this.client.writeChunkSize;
  return runTest()
    .finally(() => {
      this.client.basePath_ = oldBasePath;
      this.client.readChunkSize = oldReadSize;
      this.client.writeChunkSize = oldWriteSize;
    });
};
Cli.addCommand_(['_run_test_fsp'], 0, 0, '', '',
                Cli.commandTestFsp_);
