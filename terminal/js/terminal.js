// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

// CSP means that we can't kick off the initialization from the html file,
// so we do it like this instead.
window.onload = function() {
  // TODO(crbug.com/999028): Make sure system web apps are not discarded as
  // part of lifecycle API.  This fix used by crosh and nassh are not
  // guaranteed to be a long term solution.
  chrome.tabs.getCurrent((tab) => {
    chrome.tabs.update(tab.id, {autoDiscardable: false});
  });
  lib.init(Terminal.init);
};

/**
 * The Terminal command.
 *
 * This class defines a command that can be run in an hterm.Terminal instance.
 * The Terminal command uses the terminalPrivate extension API to create and
 * use the vmshell process on a Chrome OS machine.
 *
 * @param {Object} argv The argument object passed in from the Terminal.
 */
function Terminal(argv) {
  this.commandName = argv.commandName;
  this.argv_ = argv;
  this.io = null;
  this.keyboard_ = null;
  this.id_ = null;
}

/**
 * Static initializer.
 *
 * This constructs a new Terminal instance and instructs it to run the Terminal
 * command.
 */
Terminal.init = function() {
  const params = new URLSearchParams(document.location.search);
  var terminal = new hterm.Terminal();

  // If we want to execute something other than the default vmshell.
  const commandName = params.get('command') || 'vmshell';
  window.document.title = commandName;

  terminal.decorate(document.querySelector('#terminal'));
  const runTerminal = function() {
    terminal.setCursorPosition(0, 0);
    terminal.setCursorVisible(true);
    terminal.runCommandClass(Terminal, commandName, params.getAll('args[]'));

    terminal.command.keyboard_ = terminal.keyboard;
  };
  terminal.onTerminalReady = function() {
    if (window.chrome && chrome.accessibilityFeatures &&
        chrome.accessibilityFeatures.spokenFeedback) {
      chrome.accessibilityFeatures.spokenFeedback.onChange.addListener(
          (details) => terminal.setAccessibilityEnabled(details.value));
      chrome.accessibilityFeatures.spokenFeedback.get({}, function(details) {
        terminal.setAccessibilityEnabled(details.value);
        runTerminal();
      });
    } else {
      runTerminal();
    }
  };

  // TODO(crbug.com/998920): Add terminal.contextMenu.setItems([string,
  // function]) when translated strings are available via
  // chrome://terminal/strings.js.

  // Useful for console debugging.
  window.term_ = terminal;
  return true;
};

/**
 * Called when an event from the vmshell process is detected.
 *
 * @param id Id of the process the event came from.
 * @param type Type of the event.
 *             'stdout': Process output detected.
 *             'exit': Process has exited.
 * @param text Text that was detected on process output.
 */
Terminal.prototype.onProcessOutput_ = function(id, type, text) {
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
Terminal.prototype.run = function() {
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

    window.onbeforeunload = this.onBeforeUnload_.bind(this);
    this.id_ = id;

    // Setup initial window size.
    this.onTerminalResize_(
        this.io.terminal_.screenSize.width,
        this.io.terminal_.screenSize.height);
  };

  chrome.terminalPrivate.openTerminalProcess(
      this.commandName, this.argv_.args, pidInit);
};

Terminal.prototype.onBeforeUnload_ = function(e) {
  // Note: This message doesn't seem to be shown by browsers.
  const msg = `Closing this tab will exit ${this.commandName}.`;
  e.returnValue = msg;
  return msg;
};

/**
 * Send a string to the terminal process.
 *
 * @param {string} string The string to send.
 */
Terminal.prototype.sendString_ = function(string) {
  if (this.id_ === null) {
    return;
  }
  chrome.terminalPrivate.sendInput(this.id_, string);
};

/**
 * Closes the terminal and exits the command.
 */
Terminal.prototype.close_ = function() {
  if (this.id_ === null) {
    return;
  }
  chrome.terminalPrivate.closeTerminalProcess(this.id_);
  this.id_ = null;
};

/**
 * Notify process about new terminal size.
 *
 * @param {string|integer} terminal width.
 * @param {string|integer} terminal height.
 */
Terminal.prototype.onTerminalResize_ = function(width, height) {
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
 */
Terminal.prototype.exit = function(code) {
  this.close_();
  window.onbeforeunload = null;

  if (code == 0) {
    this.io.pop();
    if (this.argv_.onExit)
      this.argv_.onExit(code);
    return;
  }
};
