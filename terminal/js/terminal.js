// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

const terminal = {};

/**
 * The Terminal command.
 *
 * This class defines a command that can be run in an hterm.Terminal instance.
 * The Terminal command uses the terminalPrivate extension API to create and
 * use the vmshell process on a Chrome OS machine.
 *
 * @param {{
     commandName: string,
 *   args: !Array<string>,
 * }} argv The argument object passed in from the Terminal.
 * @constructor
 */
terminal.Command = function(argv) {
  this.commandName = argv.commandName;
  this.argv_ = argv;
  this.io = null;
  this.keyboard_ = null;
  // We pass this ID to chrome to use for startup text which is sent before the
  // vsh process is created and we receive an ID from openTerminalProcess.
  this.id_ = Math.random().toString().substring(2);
  argv.args.push('--startup_id=' + this.id_);
};

/**
 * Static initializer.
 *
 * This constructs a new hterm.Terminal instance and instructs it to run
 * the Terminal command.
 *
 * @return {!hterm.Terminal} The new hterm.Terminal instance.
 */
terminal.init = function() {
  const params = new URLSearchParams(document.location.search);
  let term = new hterm.Terminal();

  // If we want to execute something other than the default vmshell.
  const commandName = params.get('command') || 'vmshell';
  window.document.title = commandName;

  term.decorate(lib.notNull(document.querySelector('#terminal')));
  const runTerminal = function() {
    term.setCursorPosition(0, 0);
    term.setCursorVisible(true);
    term.runCommandClass(
        terminal.Command, commandName, params.getAll('args[]'));

    term.command.keyboard_ = term.keyboard;
  };
  term.onTerminalReady = function() {
    if (window.chrome && chrome.accessibilityFeatures &&
        chrome.accessibilityFeatures.spokenFeedback) {
      chrome.accessibilityFeatures.spokenFeedback.onChange.addListener(
          (details) => term.setAccessibilityEnabled(details.value));
      chrome.accessibilityFeatures.spokenFeedback.get({}, (details) => {
        term.setAccessibilityEnabled(details.value);
        runTerminal();
      });
    } else {
      runTerminal();
    }
  };

  // TODO(crbug.com/998920): Add terminal.contextMenu.setItems([string,
  // function]) when translated strings are available via
  // chrome://terminal/strings.js.

  return term;
};

/**
 * Called when an event from the vmshell process is detected.
 *
 * @param {string} id Id of the process the event came from.
 * @param {string} type Type of the event.
 *             'stdout': Process output detected.
 *             'exit': Process has exited.
 * @param {string} text Text that was detected on process output.
 */
terminal.Command.prototype.onProcessOutput_ = function(id, type, text) {
  if (this.id_ === null || id !== this.id_) {
    return;
  }

  if (type == 'exit') {
    this.exit(0);
    return;
  }
  this.io.print(text);
};

/**
 * Start the terminal command.
 *
 * This is invoked by the terminal as a result of terminal.runCommandClass().
 */
terminal.Command.prototype.run = function() {
  this.io = this.argv_.io.push();

  if (!chrome.terminalPrivate) {
    this.io.println(
        'Launching terminal failed: chrome.terminalPrivate not found');
    this.exit(1);
    return;
  }

  this.io.onVTKeystroke = this.io.sendString = this.sendString_.bind(this);

  this.io.onTerminalResize = this.onTerminalResize_.bind(this);
  chrome.terminalPrivate.onProcessOutput.addListener(
      this.onProcessOutput_.bind(this));
  document.body.onunload = this.close_.bind(this);

  const pidInit = (id) => {
    if (id === undefined) {
      this.io.println(
          `Launching ${this.commandName} failed: ${lib.f.lastError('')}`);
      this.exit(1);
      return;
    }

    this.id_ = id;

    // Setup initial window size.
    this.onTerminalResize_(
        this.io.terminal_.screenSize.width,
        this.io.terminal_.screenSize.height);
  };

  chrome.terminalPrivate.openTerminalProcess(
      this.commandName, this.argv_.args, pidInit);
};

/**
 * Send a string to the terminal process.
 *
 * @param {string} string The string to send.
 */
terminal.Command.prototype.sendString_ = function(string) {
  if (this.id_ === null) {
    return;
  }
  chrome.terminalPrivate.sendInput(this.id_, string);
};

/**
 * Closes the terminal and exits the command.
 */
terminal.Command.prototype.close_ = function() {
  if (this.id_ === null) {
    return;
  }
  chrome.terminalPrivate.closeTerminalProcess(this.id_);
  this.id_ = null;
};

/**
 * Notify process about new terminal size.
 *
 * @param {string|number} width The new terminal width.
 * @param {string|number} height The new terminal height.
 */
terminal.Command.prototype.onTerminalResize_ = function(width, height) {
  if (this.id_ === null) {
    return;
  }

  chrome.terminalPrivate.onTerminalResize(
      this.id_, Number(width), Number(height), function(success) {
        if (!success)
          console.warn('terminalPrivate.onTerminalResize failed');
      });
};

/**
 * Exit the terminal command.
 *
 * @param {number} code Exit code, 0 for success.
 */
terminal.Command.prototype.exit = function(code) {
  this.close_();

  if (code == 0) {
    this.io.pop();
    if (this.argv_.onExit)
      this.argv_.onExit(code);
    return;
  }
};
