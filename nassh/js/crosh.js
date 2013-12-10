// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.f',
          'hterm');

// CSP means that we can't kick off the initialization from the html file,
// so we do it like this instead.
window.onload = function() {
  lib.init(Crosh.init);
};

/**
 * The Crosh-powered terminal command.
 *
 * This class defines a command that can be run in an hterm.Terminal instance.
 * The Crosh command uses terminalPrivate extension API to create and use crosh
 * process on ChromeOS machine.
 *
 *
 * @param {Object} argv The argument object passed in from the Terminal.
 */
function Crosh(argv) {
  this.argv_ = argv;
  this.io = null;
  this.pid_ = -1;
};

/**
 * The extension id of "crosh_builtin", the version of crosh that ships with
 * the Chromium OS system image.
 *
 * See https://chromium.googlesource.com/chromiumos/platform/assets/+/master/
 * chromeapps/crosh_builtin/
 */
Crosh.croshBuiltinId = 'nkoccljplnhpfnfiajclkommnmllphnl';

/**
 * Static initialier called from crosh.html.
 *
 * This constructs a new Terminal instance and instructs it to run the Crosh
 * command.
 */
Crosh.init = function() {
  var profileName = lib.f.parseQuery(document.location.search)['profile'];
  var terminal = new hterm.Terminal(profileName);

  if (chrome.runtime.id != Crosh.croshBuiltinId) {
    // We want to override the Ctrl-Shift-N keystroke so it opens nassh.html,
    // and its connection dialog, rather than reloading crosh.html.
    //
    // The builtin version of crosh does not come with nassh, so it won't work
    // from there.
    terminal.onTerminalReady = function() {
      var openSecureShell = function() {
          window.open('/html/nassh.html', '',
                      'chrome=no,close=yes,resize=yes,scrollbars=yes,' +
                      'minimizable=yes,width=' + window.innerWidth +
                      ',height=' + window.innerHeight);
          return hterm.Keyboard.KeyActions.CANCEL;
      };

      terminal.keyboard.keyMap.keyDefs[78].control = function(e) {
        if (e.shiftKey)
          return openSecureShell();

        return '\x0e';
      };

      terminal.keyboard.keyMap.keyDefs[78].meta = function(e) {
        if (e.shiftKey)
          return openSecureShell();

        return hterm.Keyboard.KeyActions.DEFAULT;
      };
    };
  }

  terminal.decorate(document.querySelector('#terminal'));

  // Useful for console debugging.
  window.term_ = terminal;

  // Looks like there is a race between this and terminal initialization, thus
  // adding timeout.
  setTimeout(function() {
      terminal.setCursorPosition(0, 0);
      terminal.setCursorVisible(true);
      terminal.runCommandClass(Crosh, document.location.hash.substr(1));
    }, 500);
  return true;
};

/**
 * The name of this command used in messages to the user.
 *
 * Perhaps this will also be used by the user to invoke this command, if we
 * build a shell command.
 */
Crosh.prototype.commandName = 'crosh';

/**
 * Called when an event from the crosh process is detected.
 *
 * @param pid Process id of the process the event came from.
 * @param type Type of the event.
 *             'stdout': Process output detected.
 *             'exit': Process has exited.
 * @param text Text that was detected on process output.
**/
Crosh.prototype.onProcessOutput_ = function(pid, type, text) {
  if (this.pid_ == -1 || pid != this.pid_)
    return;

  if (type == 'exit') {
    this.exit(0);
    return;
  }
  this.io.print(text);
}

/**
 * Start the crosh command.
 *
 * This is invoked by the terminal as a result of terminal.runCommandClass().
 */
Crosh.prototype.run = function() {
  this.io = this.argv_.io.push();

  if (!chrome.terminalPrivate) {
    this.io.println("Crosh is not supported on this version of Chrome.");
    this.exit(1);
    return;
  }

  this.io.onVTKeystroke = this.sendString_.bind(this);
  this.io.sendString = this.sendString_.bind(this);

  var self = this;
  this.io.onTerminalResize = this.onTerminalResize_.bind(this);
  chrome.terminalPrivate.onProcessOutput.addListener(
      this.onProcessOutput_.bind(this));
  document.body.onunload = this.close_.bind(this);
  chrome.terminalPrivate.openTerminalProcess(this.commandName,
      function(pid) {
        if (pid == undefined || pid == -1) {
          self.io.println("Opening crosh process failed.");
          self.exit(1);
          return;
        }

        window.onbeforeunload = self.onBeforeUnload_.bind(self);
        self.pid_ = pid;

        if (!chrome.terminalPrivate.onTerminalResize) {
          console.warn("Terminal resizing not supported.");
          return;
        }

        // Setup initial window size.
        self.onTerminalResize_(self.io.terminal_.screenSize.width,
                               self.io.terminal_.screenSize.height);
      }
  );
};

Crosh.prototype.onBeforeUnload_ = function(e) {
  var msg = 'Closing this tab will exit crosh.';
  e.returnValue = msg;
  return msg;
};

/**
 * Send a string to the crosh process.
 *
 * @param {string} string The string to send.
 */
Crosh.prototype.sendString_ = function(string) {
  if (this.pid_ == -1)
    return;
  chrome.terminalPrivate.sendInput(this.pid_, string);
};

/**
 * Closes crosh terminal and exits the crosh command.
**/
Crosh.prototype.close_ = function() {
    if (this.pid_ == -1)
      return;
    chrome.terminalPrivate.closeTerminalProcess(this.pid_);
    this.pid_ = -1;
}

/**
 * Notify process about new terminal size.
 *
 * @param {string|integer} terminal width.
 * @param {string|integer} terminal height.
 */
Crosh.prototype.onTerminalResize_ = function(width, height) {
  if (this.pid_ == -1)
    return;

  // We don't want to break older versions of chrome.
  if (!chrome.terminalPrivate.onTerminalResize)
    return;

  chrome.terminalPrivate.onTerminalResize(this.pid_,
      Number(width), Number(height),
      function(success) {
        if (!success)
          console.warn("terminalPrivate.onTerminalResize failed");
      }
  );
};

/**
 * Exit the crosh command.
 */
Crosh.prototype.exit = function(code) {
  this.close_();
  window.onbeforeunload = null;

  if (code == 0) {
    this.io.pop();
    if (this.argv_.onExit)
      this.argv_.onExit(code);
    return;
  }

  this.io.println('crosh exited with code: ' + code);
  this.io.println('(R)e-execute, (C)hoose another connection, or E(x)it?');
  this.io.onVTKeystroke = function(string) {
    var ch = string.toLowerCase();
    if (ch == 'r' || ch == ' ' || ch == '\x0d' /* enter */ ||
        ch == '\x12' /* ctrl-r */) {
      document.location.reload();
      return;
    }

    if (ch == 'c') {
      document.location = '/html/nassh.html';
      return;
    }

    if (ch == 'e' || ch == 'x' || ch == '\x1b' /* ESC */ ||
        ch == '\x17' /* C-w */) {
      this.io.pop();
      if (this.argv_.onExit)
        this.argv_.onExit(code);
    }
  }.bind(this);
};
