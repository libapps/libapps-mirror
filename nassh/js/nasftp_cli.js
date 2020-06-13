// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview This file manages the command line sftp client logic.  Not to
 *                be confused with the nassh.sftp.client class which provides a
 *                JS API only.
 */

/**
 * Progress bar helper.
 *
 * @param {!hterm.Terminal} terminal The terminal to display to.
 * @param {number=} max The highest byte count we expect.
 * @constructor
 */
nasftp.ProgressBar = function(terminal, max) {
  this.terminal_ = terminal;
  this.io_ = terminal.io;

  this.startTime_ = performance.now();
  this.endTime_ = this.startTime_;

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
  this.maxFormat_ = nasftp.Cli.format_(this.max_);
};

/**
 * Progress is tracked as a random spinner.
 */
nasftp.ProgressBar.prototype.RANDOM = Symbol('Random');

/**
 * Progress is tracked as a percentage output.
 */
nasftp.ProgressBar.prototype.PERCENTAGE = Symbol('Percentage');

/**
 * Display the next step in the progress bar.
 *
 * @param {number=} pos The new byte count.
 */
nasftp.ProgressBar.prototype.update = function(pos = 0) {
  if (this.mode_ == this.RANDOM) {
    this.io_.print(`${String.fromCodePoint(this.pos_)}\r`);
    // Pick a new random code point.
    this.pos_ =
        Math.floor(Math.random() * (this.max_ - this.min_ + 1)) + this.min_;
  } else {
    const percent = Math.round(pos / this.max_ * 100);
    this.pos_ = pos;
    this.io_.print(`\r${pos} / ${this.maxFormat_} (${percent}%)`);
  }
};

/**
 * Cleans up the progress bar output.
 *
 * @param {boolean=} summarize Whether to display a statistics summary.
 */
nasftp.ProgressBar.prototype.finish = function(summarize = false) {
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
nasftp.ProgressBar.prototype.summarize = function(max) {
  if (max === undefined) {
    max = this.max_;
  }
  const delta = this.endTime_ - this.startTime_;
  const secs = Math.round(delta) / 1000;
  const rate = Math.round(max / delta * 1000);
  this.io_.println(nassh.msg(
      'NASFTP_PROGRESS_SUMMARY', [max, secs, nasftp.Cli.format_(rate)]));
};

/**
 * The command line sftp client.
 *
 * @param {!nassh.CommandInstance} commandInstance The command instance to bind.
 * @constructor
 */
nasftp.Cli = function(commandInstance) {
  // The nassh command instance we're bound to.
  this.commandInstance_ = commandInstance;

  // The user's terminal.
  // A local shortcut since we use it often in this class.
  this.io = this.commandInstance_.io;
  this.terminal = this.io.terminal_;

  // The nassh.sftp.client object.
  // A local shortcut since we use it often in this class.
  this.client = this.commandInstance_.sftpClient;

  // The initial path for the sftp client.  The user can change at runtime via
  // the `cd` command.
  this.cwd = './';

  // The pending user line buffer.
  this.stdin_ = '';

  // The undisplayed user input.
  this.buffered_ = '';
  this.holdInput_ = false;

  // Used to manually break a connection.
  this.killCount_ = 0;

  // Command line history.
  this.history_ = [];
  this.historyPosition_ = -1;
  this.historyStash_ = '';

  // The color settings for this session.
  this.colorMap_ = Object.assign({}, nasftp.Cli.colorMap_);

  // The prompt settings for this session.
  this.prompt_ = undefined;

  // Whether the user has interrupted long running commands.
  this.userInterrupted_ = false;

  // Bind user input functions.
  this.io.sendString = this.io.onVTKeystroke = this.onInput_.bind(this);

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
  this.commands_ = this.translateCommands(nasftp.Cli.commands);

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
nasftp.Cli.prototype.escapeString_ = function(string = '') {
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
nasftp.Cli.format_ = function(number) {
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
nasftp.Cli.prototype.rawprint_ = function(string = '') {
  this.io.print(this.escapeString_(string));
};

/**
 * Like rawprint_, but includes a newline.
 *
 * @param {string} string The string to filter and display.
 */
nasftp.Cli.prototype.rawprintln_ = function(string) {
  this.rawprint_(string);
  this.io.println('');
};

/**
 * Run a specific internal command.
 *
 * @param {string|!Array<string>} userArgs The command to run.
 * @return {!Promise} A promise that resolves once the command finishes.
 */
nasftp.Cli.prototype.dispatchCommand_ = function(userArgs) {
  let args;
  if (typeof userArgs == 'string') {
    // The existing func isn't great, but it's better than nothing.
    const cmdline = nassh.CommandInstance.splitCommandLine(userArgs);
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
    this.showError_(nassh.msg('NASFTP_ERROR_INTERNAL', [e]));
    const lines = e.stack.split(/[\r\n]/);
    lines.forEach((line) => this.rawprintln_(line));
  };

  try {
    return handler.call(this, args)
      .catch((response) => {
        if (response instanceof nassh.sftp.StatusError) {
          this.showSftpStatusError_(response, args.cmd);
        } else if (response !== undefined) {
          showCrash(response);
        }
      });
  } catch (e) {
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
nasftp.Cli.prototype.onInputChar_ = function(ch) {
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
        window.removeEventListener('unhandledrejection', finishCommand);
        resolve();

        if (e) {
          if (e.reason instanceof nassh.sftp.StatusError) {
            this.showSftpStatusError_(e.reason, data);
          } else {
            this.showError_(nassh.msg('NASFTP_ERROR_INTERNAL', [e.reason]));
          }
        }

        // Add non-empty entries into the history.
        if (this.stdin_.length) {
          this.history_.unshift(this.stdin_);
          if (this.history_.length > 100) {
            this.history_.length = 100;
          }
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
      window.addEventListener('unhandledrejection', finishCommand);

      // Dispatch the command and wait for it to finish.
      return this.dispatchCommand_(data)
        .catch((cmd) => {
          // Don't warn when the user just hits enter w/out a command.
          if (cmd) {
            this.showError_(nassh.msg('NASFTP_ERROR_UNKNOWN_CMD', [cmd]));
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
 * @return {!Promise} A promise that resolves once all processing is done.
 */
nasftp.Cli.prototype.onInput_ = function(string) {
  // If we got an empty event, just return;
  if (string.length == 0) {
    return Promise.resolve();
  }
  this.buffered_ += string;

  // If we're in the middle of processing a command, only queue new input.
  if (this.holdInput_) {
    return Promise.resolve();
  }

  const processNextChar = () => {
    // If we're done processing the whole buffer, return.
    if (this.buffered_.length == 0) {
      return;
    }

    // Note: This splits UTF-16 surrogate pairs incorrectly.  However, this
    // shouldn't be a problem in practice as we only run commands based on
    // newlines, and the commands should only match on complete strings.
    const ch = this.buffered_[0];
    this.buffered_ = this.buffered_.slice(1);

    return this.onInputChar_(ch)
      .then(processNextChar);
  };

  this.holdInput_ = true;
  return processNextChar()
    .finally(() => {
      this.holdInput_ = false;
    });
};

/**
 * Callback for handling interrupt requests (Ctrl+C).
 *
 * @return {!hterm.Keyboard.KeyActions}
 */
nasftp.Cli.prototype.onCtrlCKey_ = function() {
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
nasftp.Cli.prototype.onCtrlDKey_ = function() {
  // If we're processing a command still, don't do anything.
  if (this.holdInput_) {
    return hterm.Keyboard.KeyActions.CANCEL;
  }

  if (this.stdin_ == '') {
    this.io.println('');
    nasftp.Cli.commandQuit_.call(this, []);
  }

  return hterm.Keyboard.KeyActions.CANCEL;
};

/**
 * Callback for handling clear screen requests (Ctrl+L).
 *
 * @return {!hterm.Keyboard.KeyActions}
 */
nasftp.Cli.prototype.onCtrlLKey_ = function() {
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
nasftp.Cli.prototype.onCtrlUKey_ = function() {
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
nasftp.Cli.prototype.onCtrlWKey_ = function() {
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
nasftp.Cli.prototype.onCtrlBackslashKey_ = function() {
  if (this.holdInput_) {
    if (++this.killCount_ > 2) {
      this.io.println(nassh.msg('NASFTP_FORCE_QUIT'));
      nasftp.Cli.commandQuit_.call(this, []);
    }
  }

  return hterm.Keyboard.KeyActions.CANCEL;
};

/**
 * Callback for handling backspace keys.
 *
 * @return {!hterm.Keyboard.KeyActions}
 */
nasftp.Cli.prototype.onBackspaceKey_ = function() {
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
 * Callback for handling autocomplete matches.
 *
 * @return {!hterm.Keyboard.KeyActions}
 */
nasftp.Cli.prototype.onTabKey_ = function() {
  // If we're processing a command still, don't do anything.
  if (this.holdInput_) {
    return hterm.Keyboard.KeyActions.CANCEL;
  }

  // Autocomplete.  We support the first word only currently.
  const ary = this.stdin_.split(/\s+/);
  if (ary.length != 1) {
    return hterm.Keyboard.KeyActions.CANCEL;
  }

  // See what matches are available.
  const matches = [];
  const usercmd = ary[0];
  for (const command in this.commands_) {
    // Hack: don't expand internal commands unless explicitly requested.
    if (usercmd.length == 0 && command.startsWith('_')) {
      continue;
    }

    // Add commands that match the user's input.
    if (command.startsWith(usercmd)) {
      matches.push(command);
    }
  }

  // Process the matches.
  switch (matches.length) {
    case 0: {
      // No matches.
      this.terminal.ringBell();
      break;
    }
    case 1: {
      // Exactly one match -- complete it.
      const complete = `${matches[0].substr(usercmd.length)} `;
      this.io.print(complete);
      this.stdin_ += complete;
      break;
    }
    default: {
      // More than one match -- show them all.
      this.terminal.ringBell();
      this.io.println('');
      matches.forEach((complete) => {
        this.io.print(`${complete}   `);
      });
      this.io.println('');
      this.showPrompt_();
      this.io.print(this.stdin_);
      break;
    }
  }

  return hterm.Keyboard.KeyActions.CANCEL;
};

/**
 * Callback for moving back in command history.
 *
 * @return {!hterm.Keyboard.KeyActions}
 */
nasftp.Cli.prototype.onUpArrowKey_ = function() {
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
nasftp.Cli.prototype.onDownArrowKey_ = function() {
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
nasftp.Cli.colorMap_ = {
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
 * Cache the SGR sequences.
 */
lib.registerInit('nasftp color cache', () => {
  Object.entries(nasftp.Cli.colorMap_).forEach(([key, setting]) => {
    nasftp.Cli.colorMap_[key] = nassh.sgrSequence(setting);
  });
});

/**
 * Helper to show the CLI prompt to the user.
 *
 * TODO: Allow customization.
 */
nasftp.Cli.prototype.showPrompt_ = function() {
  let prompt = this.prompt_;
  const defaultPrompt = nassh.msg('NASFTP_PROMPT', ['%(cwd)']);
  if (prompt === undefined) {
    // Normally one should not mess with translation text.  But it's a bit hard
    // to preserve colorization settings.  So hand insert it if possible.
    prompt = defaultPrompt.replace('nasftp', '%(prompt)nasftp%(reset)');
  } else if (this.prompt_ == '') {
    prompt = defaultPrompt.replace(
        'nasftp',
        '%(bold)' +
        nassh.sgrSequence({fg: '38:2:51:105:232'}) + 'n' +
        nassh.sgrSequence({fg: '38:2:213:15:37'}) + 'a' +
        nassh.sgrSequence({fg: '38:2:238:178:17'}) + 's' +
        nassh.sgrSequence({fg: '38:2:51:105:232'}) + 'f' +
        nassh.sgrSequence({fg: '38:2:0:153:37'}) + 't' +
        nassh.sgrSequence({fg: '38:2:213:15:37'}) + 'p' +
        '%(reset)');
  }

  const vars = Object.assign({}, this.colorMap_, {
    'cwd': this.escapeString_(this.cwd),
  });

  this.io.print(lib.f.replaceVars(lib.notUndefined(prompt), vars));
};

/**
 * Helper to show error messages to the user.
 *
 * @param {string} msg The message to show.
 */
nasftp.Cli.prototype.showError_ = function(msg) {
  this.io.println(nassh.msg('NASFTP_ERROR_MESSAGE', [msg]));
};

/**
 * Helper to decode SFTP status errors for the user.
 *
 * @param {!nassh.sftp.StatusError} response The status error packet.
 * @param {string} cmd The current command we're processing.
 */
nasftp.Cli.prototype.showSftpStatusError_ = function(response, cmd) {
  let msgId;
  const msgArgs = [cmd];
  switch (response.code) {
    case nassh.sftp.packets.StatusCodes.EOF:
      msgId = 'NASFTP_ERROR_END_OF_FILE';
      break;
    case nassh.sftp.packets.StatusCodes.NO_SUCH_FILE:
      msgId = 'NASFTP_ERROR_FILE_NOT_FOUND';
      break;
    case nassh.sftp.packets.StatusCodes.PERMISSION_DENIED:
      msgId = 'NASFTP_ERROR_PERMISSION_DENIED';
      break;
    default:
      msgId = 'NASFTP_ERROR_SERVER_ERROR';
      msgArgs.push(response.message);
      break;
  }
  this.showError_(nassh.msg(msgId, msgArgs));
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
nasftp.Cli.prototype.parseInt_ = function(
    cmd, argName, argValue, defaultValue = 0, radix = undefined) {
  if (argValue === undefined) {
    return defaultValue;
  }

  let ret = parseInt(argValue, radix);
  if (!isFinite(ret)) {
    this.showError_(nassh.msg('NASFTP_ERROR_INVALID_NUMBER', [
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
      this.showError_(nassh.msg('NASFTP_ERROR_INVALID_NUMBER', [
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
nasftp.Cli.prototype.parseOpts_ = function(args, optstring) {
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
          this.showError_(nassh.msg(
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
nasftp.Cli.prototype.basename = function(path) {
  const ary = path.replace(/\/+$/, '').split('/');
  return ary[ary.length - 1];
};

/**
 * Create an absolute path that respects the user's cwd setting.
 *
 * @param {string} path The path (relative or absolute) to convert.
 * @return {string} The absolute path.
 */
nasftp.Cli.prototype.makePath_ = function(path) {
  return path.startsWith('/') ? path : this.cwd + path;
};

/**
 * Process the queued commands and translate their text.
 *
 * @param {!Object} commands A map of registered commands and their callbacks.
 * @return {!Object} The command map with translated strings.
 */
nasftp.Cli.prototype.translateCommands = function(commands) {
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
    msg = nassh.msg(msgId);
    if (msg != msgId) {
      rv[msg] = obj;
    }

    // Add the help translation text if available.
    msgId += '_HELP';
    msg = nassh.msg(msgId);
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
nasftp.Cli.commands = {};

/**
 * Helper to register a command.
 *
 * @param {!Array<string>} commands The commands (and aliases) to register.
 * @param {number} minArgs The minimum number of arguments this command needs.
 * @param {?number} maxArgs The maximum number of arguments this command
 *     accepts.
 * @param {string} optstring Supported short options.
 * @param {string} usage Example command arguments.
 * @param {function(!Array<string>, !Object)} callback The function to run the
 *     command.
 */
nasftp.Cli.addCommand_ = function(
    commands, minArgs, maxArgs, optstring, usage, callback) {
  commands.forEach((command) => {

    /**
     * @this {nasftp.Cli}
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
        this.showError_(nassh.msg('NASFTP_ERROR_NOT_ENOUGH_ARGS', [args.cmd]));
        return Promise.resolve();
      }

      if (maxArgs !== null && args.length > maxArgs) {
        this.showError_(nassh.msg('NASFTP_ERROR_TOO_MANY_ARGS', [args.cmd]));
        return Promise.resolve();
      }

      return callback.call(this, args, opts);
    };

    nasftp.Cli.commands[command] = wrapper;
    wrapper.command = command;
    wrapper.optstring = optstring;
    wrapper.usage = optstring ? `[-${optstring}] ${usage}` : usage;
    // We'll fill this in later during the translation step.
    wrapper.help = commands[0];
  });
};

/**
 * User command to dump a file.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandCat_ = function(args) {
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
nasftp.Cli.addCommand_(['cat'], 1, 3, '', '<path> [offset] [length]',
                       nasftp.Cli.commandCat_);

/**
 * User command to change the directory.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandCd_ = function(args) {
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
nasftp.Cli.addCommand_(['chdir', 'cd'], 0, 1, '', '[path]',
                       nasftp.Cli.commandCd_);

/**
 * User command to change path permissions.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandChmod_ = function(args) {
  const mode = parseInt(args.shift(), 8);

  const attrs = {
    'flags': nassh.sftp.packets.FileXferAttrs.PERMISSIONS,
    'permissions': mode,
  };

  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    return this.client.setFileStatus(this.makePath_(path), attrs);
  }), Promise.resolve());
};
nasftp.Cli.addCommand_(['chmod'], 2, null, '', '<mode> <paths...>',
                       nasftp.Cli.commandChmod_);

/**
 * User command to change user/group ownership.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandChown_ = function(args) {
  const account = this.parseInt_(args.cmd, 'account', args.shift());

  if (account === null) {
    return Promise.resolve();
  }

  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    return this.client.fileStatus(this.makePath_(path))
      .then((attrs) => {
        const newAttrs = {
          'flags': nassh.sftp.packets.FileXferAttrs.UIDGID,
          'uid': attrs.uid,
          'gid': attrs.gid,
        };
        if (args.cmd == 'chown') {
          newAttrs.uid = account;
        } else {
          newAttrs.gid = account;
        }
        return this.client.setFileStatus(this.makePath_(path), newAttrs);
      });
  }), Promise.resolve());
};
nasftp.Cli.addCommand_(['chgrp', 'chown'], 2, null, '', '<account> <paths...>',
                       nasftp.Cli.commandChown_);

/**
 * User command to clear the screen.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} _args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandClear_ = function(_args) {
  this.terminal.clearHome();
  return Promise.resolve();
};
nasftp.Cli.addCommand_(['clear'], 0, 0, '', '',
                       nasftp.Cli.commandClear_);

/**
 * User command to copy a file to the clipboard.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandClip_ = function(args) {
  const path = args.shift();
  const offset = this.parseInt_(args.cmd, 'offset', args.shift());
  const length = this.parseInt_(args.cmd, 'length', args.shift(),
                                10 * 1024 * 1024);

  if (length === null || offset === null) {
    return Promise.resolve();
  }

  const spinner = new nasftp.ProgressBar(this.terminal);
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
      this.io.println(nassh.msg('NASFTP_CMD_CLIP_SUMMARY', [string.length]));
      this.terminal.copyStringToClipboard(string);
    });
};
nasftp.Cli.addCommand_(['clip', 'clipboard'], 1, 3, '',
                       '<path> [offset] [length]',
                       nasftp.Cli.commandClip_);

/**
 * User command to toggle color support.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} _args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandColor_ = function(_args) {
  if (this.colorMap_['prompt']) {
    Object.keys(this.colorMap_).forEach((key) => {
      this.colorMap_[key] = '';
    });
  } else {
    this.colorMap_ = Object.assign({}, nasftp.Cli.colorMap_);
  }

  // Always keep 'reset' working for the prompt.
  this.colorMap_['reset'] = nasftp.Cli.colorMap_['reset'];

  return Promise.resolve();
};
nasftp.Cli.addCommand_(['color'], 0, 0, '', '',
                       nasftp.Cli.commandColor_);

/**
 * User command to copy files.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandCopy_ = function(args) {
  const src = this.makePath_(args.shift());
  const dst = this.makePath_(args.shift());

  if (this.client.protocolServerExtensions['copy-data'] === undefined) {
    this.showError_(nassh.msg(
        'NASFTP_ERROR_MISSING_PROTOCOL_EXTENSION', [args.cmd, 'copy-data']));
    return Promise.resolve();
  }

  // Make sure the source file exists.
  return this.client.fileStatus(src)
    .then((attrs) => {
      // Only copy regular files.
      if (attrs.isRegularFile !== true) {
        this.showError_(nassh.msg(
            'NASFTP_ERROR_NON_REG_FILE', [args.cmd, src]));
        return;
      }

      // Open the source file for reading.
      let readHandle;
      return this.client.openFile(src, nassh.sftp.packets.OpenFlags.READ)
        .then((handle) => {
          readHandle = handle;

          const flags = nassh.sftp.packets.OpenFlags.WRITE |
              nassh.sftp.packets.OpenFlags.CREAT |
              nassh.sftp.packets.OpenFlags.TRUNC;

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
nasftp.Cli.addCommand_(['copy', 'cp'], 2, 2, '', '<src> <dst>',
                       nasftp.Cli.commandCopy_);

/**
 * User command to get filesystem information.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @param {!Object} opts The set of seen options.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandDiskFree_ = function(args, opts) {
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
          const fmt = nasftp.Cli.format_;
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
        this.io.println(nassh.msg('NASFTP_CMD_DF_SUMMARY', [
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
nasftp.Cli.addCommand_(['df'], 0, null, 'hi', '[paths...]',
                       nasftp.Cli.commandDiskFree_);

/**
 * User command to download files.
 *
 * Note: Large files will run into Chrome's data-uri limit which is 1MB - 2MB.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandGet_ = function(args) {
  const doc = this.terminal.getDocument();
  const a = doc.createElement('a');

  const src = args.shift();
  const dst = args.length == 0 ? this.basename(src) : args.shift();
  a.download = dst;

  this.io.println(nassh.msg('NASFTP_CMD_GET_DOWNLOAD_FILE', [
    this.escapeString_(src),
    this.escapeString_(dst),
  ]));

  // Need to add to the DOM to process events properly.
  doc.body.appendChild(a);

  let spinner;
  let offset = 0;
  const chunks = [];
  const handleChunk = (chunk) => {
    if (this.userInterrupted_) {
      return false;
    }

    offset += chunk.length;
    spinner.update(offset);
    chunks.push(chunk);
  };

  return this.client.fileStatus(this.makePath_(src))
    .then((attrs) => {
      spinner = new nasftp.ProgressBar(this.terminal, attrs.size);
      return this.client.readFile(this.makePath_(src), handleChunk);
    })
    .then(() => {
      spinner.finish(true);

      // Create a base64 encoded URI.
      const blob = new Blob(chunks);
      a.href = URL.createObjectURL(blob);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    });
};
nasftp.Cli.addCommand_(['get'], 1, 2, '', '<remote name> [local name]',
                       nasftp.Cli.commandGet_);

/**
 * User command to show help for registered commands.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandHelp_ = function(args) {
  const lhs = (command) => {
    return nassh.msg('NASFTP_CMD_HELP_LHS', [command.command, command.usage]);
  };
  let pad = 0;

  // If the user didn't request specific commands, show all of them.
  if (args.length == 0) {
    args = Object.keys(this.commands_);
  }

  // Calculate the length of commands to align the final output.
  for (const command of args) {
    if (!this.commands_.hasOwnProperty(command)) {
      this.showError_(nassh.msg('NASFTP_ERROR_UNKNOWN_CMD', [command]));
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
    this.io.println(nassh.msg('NASFTP_CMD_HELP_LINE', [
      lhs(obj).padEnd(pad), obj.help,
    ]));
  }

  return Promise.resolve();
};
nasftp.Cli.addCommand_(['help', '?'], 0, null, '', '[commands]',
                       nasftp.Cli.commandHelp_);

/**
 * User command to list information about files/directories.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @param {!Object} opts The set of seen options.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandList_ = function(args, opts) {
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

  const spinner = new nasftp.ProgressBar(this.terminal);
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
        if (response instanceof nassh.sftp.StatusError) {
          // Maybe they tried to list a file.  Synthesize a result.
          if (response.code == nassh.sftp.packets.StatusCodes.NO_SUCH_FILE) {
            return this.client.linkStatus(path)
              .then((attrs) => {
                const basename = this.basename(path);
                const mode =
                    nassh.sftp.packets.bitsToUnixModeLine(attrs.permissions);
                const date =
                    nassh.sftp.packets.epochToLocal(attrs.lastModified);
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
              let color;
              if (entry.isDirectory) {
                filename += '/';
                color = this.colorMap_['dir'];
              } else if (entry.isLink) {
                color = this.colorMap_['sym'];
              } else if (entry.isCharacterDevice) {
                color = this.colorMap_['char'];
              } else if (entry.isBlockDevice) {
                color = this.colorMap_['block'];
              } else if (entry.isFifo) {
                color = this.colorMap_['fifo'];
              } else if (entry.isSocket) {
                color = this.colorMap_['socket'];
              }
              if (color) {
                this.io.print(color);
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
nasftp.Cli.addCommand_(['list', 'ls', 'dir'], 0, null, '1aflrRSt', '[dirs...]',
                       nasftp.Cli.commandList_);

/**
 * User command to create hardlinks & symlinks.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @param {!Object} opts The set of seen options.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandLink_ = function(args, opts) {
  // Translate short options into something more readable.
  opts.symlink = opts.s;

  const target = args.shift();
  const path = args.shift();
  const func = opts.symlink ? 'symLink' : 'hardLink';
  return this.client[func](this.makePath_(target), this.makePath_(path));
};
nasftp.Cli.addCommand_(['ln'], 2, 2, 's', '<target> <path>',
                       nasftp.Cli.commandLink_);

/**
 * User command to create directories.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandMkdir_ = function(args) {
  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    return this.client.makeDirectory(this.makePath_(path));
  }), Promise.resolve());
};
nasftp.Cli.addCommand_(['mkdir'], 1, null, '', '<paths...>',
                       nasftp.Cli.commandMkdir_);

/**
 * User command to rename paths.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandMove_ = function(args) {
  const src = args.shift();
  const dst = args.shift();
  return this.client.renameFile(this.makePath_(src), this.makePath_(dst));
};
nasftp.Cli.addCommand_(['move', 'mv', 'ren', 'rename'], 2, 2, '', '<src> <dst>',
                       nasftp.Cli.commandMove_);

/**
 * User command to control the prompt.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandPrompt_ = function(args) {
  if (args.length) {
    this.prompt_ = args.shift();
  } else {
    if (this.prompt_ === undefined) {
      this.prompt_ = '';
    } else {
      this.prompt_ = undefined;
    }
  }
  return Promise.resolve();
};
nasftp.Cli.addCommand_(['prompt'], 0, 1, '', '[prompt]',
                       nasftp.Cli.commandPrompt_);

/**
 * User command to upload files.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @param {!Object} opts The set of seen options.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandPut_ = function(args, opts) {
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

        this.io.println(nassh.msg('NASFTP_CMD_PUT_UPLOAD_FILE', [
          this.escapeString_(file.name),
          this.escapeString_(name),
          nasftp.Cli.format_(file.size),
        ]));

        const spinner = new nasftp.ProgressBar(this.terminal, file.size);

        // Next promise waits for the file to be processed (read+uploaded).
        return new Promise(async (resolveOneFile) => {
          const path = this.makePath_(name);
          let offset = 0;

          // Figure out whether to resume or clobber the file.
          let flags = nassh.sftp.packets.OpenFlags.WRITE;
          let resume = opts.resume;
          if (resume) {
            try {
              const attrs = await this.client.fileStatus(path);
              offset = attrs.size;
              flags |= nassh.sftp.packets.OpenFlags.APPEND;
            } catch (e) {
              // File doesn't exist, so disable resuming.
              if (e instanceof nassh.sftp.StatusError) {
                resume = false;
              } else {
                throw e;
              }
            }
          }
          if (!resume) {
            flags |= nassh.sftp.packets.OpenFlags.CREAT |
                nassh.sftp.packets.OpenFlags.TRUNC;
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
nasftp.Cli.addCommand_(['put', 'reput'], 0, 1, 'af', '[remote name]',
                       nasftp.Cli.commandPut_);

/**
 * User command to show the active working directory.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} _args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandPwd_ = function(_args) {
  this.io.println(nassh.msg('NASFTP_CMD_PWD_OUTPUT', [
    this.escapeString_(this.cwd),
  ]));
  return Promise.resolve();
};
nasftp.Cli.addCommand_(['pwd'], 0, 0, '', '',
                       nasftp.Cli.commandPwd_);

/**
 * User command to quit the session.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} _args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandQuit_ = function(_args) {
  this.terminal.keyboard.bindings.clear();
  this.commandInstance_.exit(0, /* noReconnect= */ false);
  return Promise.resolve();
};
nasftp.Cli.addCommand_(['exit', 'quit', 'bye'], 0, 0, '', '',
                       nasftp.Cli.commandQuit_);

/**
 * User command to read a symlink.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandReadlink_ = function(args) {
  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    return this.client.readLink(this.makePath_(path))
      .then((entries) => {
        // There should be only one result, but who knows!
        entries.files.forEach((file) => this.rawprintln_(file.filename));
      });
  }), Promise.resolve());
};
nasftp.Cli.addCommand_(['readlink'], 1, null, '', '<paths...>',
                       nasftp.Cli.commandReadlink_);

/**
 * User command to resolve a path remotely.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandRealpath_ = function(args) {
  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    return this.client.realPath(this.makePath_(path))
      .then((entries) => {
        // There should be only one result, but who knows!
        entries.files.forEach((file) => this.rawprintln_(file.filename));
      });
  }), Promise.resolve());
};
nasftp.Cli.addCommand_(['realpath'], 1, null, '', '<paths...>',
                       nasftp.Cli.commandRealpath_);

/**
 * User command to remove files.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @param {!Object} opts The set of seen options.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandRemove_ = function(args, opts) {
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
      .catch((result) => {
        if (!opts.force) {
          throw result;
        }
      });
  }), Promise.resolve());
};
nasftp.Cli.addCommand_(['rm', 'del'], 1, null, 'rRfv', '<paths...>',
                       nasftp.Cli.commandRemove_);

/**
 * User command to remove directories.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandRmdir_ = function(args) {
  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    return this.client.removeDirectory(this.makePath_(path));
  }), Promise.resolve());
};
nasftp.Cli.addCommand_(['rmdir'], 1, null, '', '<paths...>',
                       nasftp.Cli.commandRmdir_);

/**
 * User command to show images.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandShow_ = function(args) {
  // Create a chain of promises by processing each path in serial.
  const spinner = new nasftp.ProgressBar(this.terminal);
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
nasftp.Cli.addCommand_(['show'], 1, null, '', '<paths...>',
                       nasftp.Cli.commandShow_);

/**
 * User command to show path status/details.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandStat_ = function(args) {
  const func = args.cmd == 'stat' ? 'fileStatus' : 'linkStatus';

  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    return this.client[func](this.makePath_(path))
      .then((attrs) => {
        this.io.println(nassh.msg('NASFTP_CMD_STAT_SUMMARY', [
          this.escapeString_(path),
          attrs.size,
          attrs.uid,
          attrs.gid,
          `0${lib.f.zpad(attrs.permissions.toString(8), 7)} ` +
          `(${nassh.sftp.packets.bitsToUnixModeLine(attrs.permissions)})`,
          `${attrs.lastAccessed} (` +
          `${nassh.sftp.packets.epochToLocal(attrs.lastAccessed)})`,
          `${attrs.lastModified} (` +
          `${nassh.sftp.packets.epochToLocal(attrs.lastModified)})`,
        ]));
        if (attrs.extensions) {
          this.io.println(nassh.msg('NASFTP_CMD_STAT_EXTENSIONS_HEADER'));
          attrs.extensions.forEach((ele) => {
            this.io.println(nassh.msg('NASFTP_CMD_STAT_EXTENSIONS_LINE', [
              this.escapeString_(ele.type),
              this.escapeString_(ele.data),
            ]));
          });
        }
      });
  }), Promise.resolve());
};
nasftp.Cli.addCommand_(['stat', 'lstat'], 1, null, '', '<paths...>',
                       nasftp.Cli.commandStat_);

/**
 * User command to truncate files.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @param {!Object} opts The set of seen options.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandTruncate_ = function(args, opts) {
  // Peel off the first positional argument if using the -s option.
  let size = 0;
  if (opts.s) {
    size = this.parseInt_(args.cmd, 'size', args.shift());
  }

  // Create a chain of promises by processing each path in serial.
  return args.reduce((chain, path) => chain.then(() => {
    // Clobber whatever file might already exist.
    const flags = nassh.sftp.packets.OpenFlags.CREAT |
      (size ? nassh.sftp.packets.OpenFlags.WRITE :
              nassh.sftp.packets.OpenFlags.TRUNC);

    // Final promise series sends open(trunc)+close packets.
    let writeHandle;
    return this.client.openFile(this.makePath_(path), flags)
      .then((handle) => {
        writeHandle = handle;

        // If truncating to a specific non-zero size, set the file size here.
        // Otherwise, the open itself truncated down to 0 bytes already.
        if (size) {
          const attrs = {
            flags: nassh.sftp.packets.FileXferAttrs.SIZE,
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
nasftp.Cli.addCommand_(['truncate'], 1, null, 's', '[-s <size>] <paths...>',
                       nasftp.Cli.commandTruncate_);

/**
 * User command to create symlinks.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandSymlink_ = function(args) {
  const target = args.shift();
  const path = args.shift();

  return this.client.symLink(this.makePath_(target), this.makePath_(path));
};
nasftp.Cli.addCommand_(['symlink'], 2, 2, '', '<target> <path>',
                       nasftp.Cli.commandSymlink_);

/**
 * User command to show the active SFTP version.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} _args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandVersion_ = function(_args) {
  this.io.println(nassh.msg('NASFTP_CMD_VERSION_SUMMARY', [
    this.client.protocolClientVersion,
    this.client.protocolServerVersion,
  ]));
  this.io.println(nassh.msg('NASFTP_CMD_VERSION_EXTENSIONS_HEADER'));

  const names = Object.keys(this.client.protocolServerExtensions).sort();
  names.forEach((name) => {
    const data = this.client.protocolServerExtensions[name];
    this.io.println(nassh.msg('NASFTP_CMD_VERSION_EXTENSIONS_LINE', [
      name, data,
    ]));
  });

  return Promise.resolve();
};
nasftp.Cli.addCommand_(['version'], 0, 0, '', '',
                       nasftp.Cli.commandVersion_);

/**
 * Run self tests.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} _args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandTestCli_ = function(_args) {
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
    .then(() => wrap('chdir', '/tmp'))
    .then(() => wrap('rm', '-Rf', base))
    .then(() => wrap('mkdir', base))
    .then(() => wrap('list', base))
    .then(() => wrap('cd', base))
    .then(() => wrap('df'))
    .then(() => wrap('df', '-i', '.'))
    .then(() => wrap('df', '-h', '/'))
    .then(() => wrap('pwd'))
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
nasftp.Cli.addCommand_(['_run_test_cli'], 0, 0, '', '',
                       nasftp.Cli.commandTestCli_);

/**
 * Run live tests of the FSP code.
 *
 * @this {nasftp.Cli}
 * @param {!Array<string>} _args The command arguments.
 * @return {!Promise<void>}
 */
nasftp.Cli.commandTestFsp_ = function(_args) {
  // Normally the FSP code is only in the background page, so load it on demand
  // so we can run our FSP tests.
  const loadFspCode = () => new Promise((resolve, reject) => {
    if (nassh.sftp.fsp !== undefined) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = '../js/nassh_sftp_fsp.js';
    script.onload = () => {
      script.onload = null;
      script.onerror = null;
      resolve();
    };
    script.onerror = () => {
      script.onload = null;
      script.onerror = null;
      reject();
    };
    document.body.appendChild(script);
  });

  // The actual test logic.
  const runTest = () => {
    const fsid = 'fsid';
    const base = '/tmp/.nasftp-tests';
    const options = {fileSystemId: fsid};
    let opts;
    const newopts = (obj) => Object.assign(options, obj);

    // Initialize fsp state.
    nassh.sftp.fsp.sftpInstances[fsid] = {
      sftpClient: this.client,
    };

    // Use smaller read/write sizes.  We just need to fragment requests.
    this.client.readChunkSize = 100;
    this.client.writeChunkSize = 200;

    // Helpers for displaying pass/fail status.
    const pass = (test, msg = '-') => this.rawprintln_(`PASS: ${test}: ${msg}`);
    const failed = (test, msg) => this.rawprintln_(`FAIL: ${test}: ${msg}`);

    /**
     * Wrapper for FSP functions to get a Promise based API.
     *
     * @param {string} name
     * @param {!Object} opts
     * @return {!Promise<!Array<*>>}
     */
    const wrap = (name, opts) => new Promise((resolve, reject) => {
      nassh.sftp.fsp[name](
          opts,
          (...args) => {
            pass(name, args);
            resolve(...args);
          },
          (msg) => {
            failed(name, msg);
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
        return wrap('onCreateDirectoryRequested', opts);
      })
      .then(() => {
        this.client.basePath_ = `${base}/`;
        opts = newopts({directoryPath: '/subdir'});
        return wrap('onCreateDirectoryRequested', opts);
      })
      .then(() => {
        opts = newopts({directoryPath: '/subdir/subdir'});
        return wrap('onCreateDirectoryRequested', opts);
      })

      // Symlink "sym" to "subdir".
      .then(() => this.client.symLink('subdir', '/sym'))
      // Copy "sym" to "newsym".
      .then(() => {
        opts = newopts({sourcePath: '/sym', targetPath: '/newsym'});
        return wrap('onCopyEntryRequested', opts);
      })
      // Delete the "sym" symlink.
      .then(() => {
        opts = newopts({entryPath: '/sym', recursive: true});
        return wrap('onDeleteEntryRequested', opts);
      })
      // Delete the "newsym" symlink.
      .then(() => {
        opts = newopts({entryPath: '/newsym', recursive: true});
        return wrap('onDeleteEntryRequested', opts);
      })
      // Verify "subdir" exists.
      .then(() => {
        opts = newopts({entryPath: '/subdir', name: true, isDirectory: true});
        return wrap('onGetMetadataRequested', opts);
      })

      // Create "x" file.
      .then(() => {
        opts = newopts({filePath: '/x'});
        return wrap('onTruncateRequested', opts);
      })
      // Rename "x" to "new".
      .then(() => {
        opts = newopts({sourcePath: '/x', targetPath: '/new'});
        return wrap('onMoveEntryRequested', opts);
      })
      // Symlink "sym" to "new".
      .then(() => this.client.symLink('new', '/sym'))
      // Delete the "sym" symlink.
      .then(() => {
        opts = newopts({entryPath: '/sym', recursive: false});
        return wrap('onDeleteEntryRequested', opts);
      })
      // Verify "new" exists.
      .then(() => {
        opts = newopts({entryPath: '/new', name: true, isDirectory: true});
        return wrap('onGetMetadataRequested', opts);
      })
      // Delete the "new" file.
      .then((_entries) => {
        opts = newopts({entryPath: '/new', recursive: false});
        return wrap('onDeleteEntryRequested', opts);
      })

      // Create the broken "brok" symlink, then delete it.
      .then(() => this.client.symLink('brok', '/brok'))
      .then(() => {
        opts = newopts({entryPath: '/brok', recursive: false});
        return wrap('onDeleteEntryRequested', opts);
      })

      // Create some files in subdirs for copying later.
      .then(() => {
        opts = newopts({filePath: '/subdir/x2'});
        return wrap('onTruncateRequested', opts);
      })
      .then(() => {
        opts = newopts({filePath: '/subdir/subdir/x3'});
        return wrap('onTruncateRequested', opts);
      })

      // Create the "file" file.
      .then(() => {
        opts = newopts({filePath: '/subdir/file', requestId: 'req'});
        return wrap('onCreateFileRequested', opts);
      })
      .then(() => {
        opts = newopts({openRequestId: 'req'});
        return wrap('onCloseFileRequested', opts);
      })

      // Write data to "file" file.
      .then(() => {
        opts = newopts({
          filePath: '/subdir/file',
          requestId: 'write',
          mode: 'WRITE',
        });
        return wrap('onOpenFileRequested', opts);
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
        return wrap('onWriteFileRequested', opts);
      })
      .then(() => {
        opts = newopts({openRequestId: 'write'});
        return wrap('onCloseFileRequested', opts);
      })

      // Read data back from "file" file.
      .then(() => {
        opts = newopts({
          filePath: '/subdir/file',
          requestId: 'read',
          mode: 'READ',
        });
        return wrap('onOpenFileRequested', opts);
      })
      // Don't read the entire file, just a large segment in the middle.
      .then(() => {
        const offset = 1;
        const length = 500;
        opts = newopts({openRequestId: 'read', offset: offset, length: length});
        // Can't use wrap() helper because onSuccess is called multiple times.
        const name = 'onReadFileRequested';
        const chunks = [];
        return new Promise((resolve, reject) => {
          nassh.sftp.fsp[name](
              opts,
              (data, hasMore) => {
                chunks.push(data);
                if (!hasMore) {
                  pass(name, chunks);
                  resolve([chunks, offset, length]);
                }
              },
              (msg) => {
                failed(name, msg);
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
        return wrap('onCloseFileRequested', opts);
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
        return wrap('onCopyEntryRequested', opts);
      })
      // Check the contents of the source tree.
      .then(() => {
        opts = newopts({entryPath: '/newdir/subdir/x3', name: true});
        return wrap('onGetMetadataRequested', opts);
      })
      .then(() => {
        opts = newopts({directoryPath: '/subdir'});
        return wrap('onReadDirectoryRequested', opts);
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
        return wrap('onReadDirectoryRequested', opts);
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
        return wrap('onDeleteEntryRequested', opts);
      })

      // Make it clear we're all done.
      .then(() => this.io.println('fsp: all tests passed!'));
  };

  // Make sure some fields we tweak are saved & restored regardless of failures.
  const oldBasePath = this.client.basePath_;
  const oldReadSize = this.client.readChunkSize;
  const oldWriteSize = this.client.writeChunkSize;
  return loadFspCode().then(runTest)
    .finally(() => {
      this.client.basePath_ = oldBasePath;
      this.client.readChunkSize = oldReadSize;
      this.client.writeChunkSize = oldWriteSize;
    });
};
nasftp.Cli.addCommand_(['_run_test_fsp'], 0, 0, '', '',
                       nasftp.Cli.commandTestFsp_);
