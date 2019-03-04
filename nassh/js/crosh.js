// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

// CSP means that we can't kick off the initialization from the html file,
// so we do it like this instead.
window.onload = function() {
  // Workaround https://crbug.com/928045.
  if (nassh.workaroundMissingChromeRuntime()) {
    return;
  }

  const params = new URLSearchParams(document.location.search);

  // Make it easy to re-open as a window.
  if (params.get('openas') == 'window') {
    // Delete the 'openas' string so we don't get into a loop.  We want to
    // preserve the rest of the query string when opening the window.
    params.delete('openas');
    const url = new URL(document.location);
    url.search = params.toString();
    Crosh.openNewWindow_(url.href).then(window.close);
    return;
  }

  // If we want to execute something other than the default crosh.
  if (params.has('command')) {
    Crosh.prototype.commandName = params.get('command');
  }
  window.document.title = Crosh.prototype.commandName;

  nassh.disableTabDiscarding();
  lib.init(Crosh.init);
};

/**
 * The Crosh-powered terminal command.
 *
 * This class defines a command that can be run in an hterm.Terminal instance.
 * The Crosh command uses terminalPrivate extension API to create and use crosh
 * process on Chrome OS machine.
 *
 *
 * @param {Object} argv The argument object passed in from the Terminal.
 */
function Crosh(argv) {
  this.argv_ = argv;
  this.io = null;
  this.keyboard_ = null;
  this.id_ = null;
}

/**
 * The extension id of "crosh_builtin", the version of crosh that ships with
 * the Chromium OS system image.
 */
Crosh.croshBuiltinId = 'nkoccljplnhpfnfiajclkommnmllphnl';

/**
 * Static initializer called from crosh.html.
 *
 * This constructs a new Terminal instance and instructs it to run the Crosh
 * command.
 */
Crosh.init = function() {
  const params = new URLSearchParams(document.location.search);
  const profileName = params.get('profile');
  var terminal = new hterm.Terminal(profileName);

  terminal.decorate(document.querySelector('#terminal'));
  const runCrosh = function() {
    terminal.keyboard.bindings.addBinding('Ctrl-Shift-P', function() {
      nassh.openOptionsPage();
      return hterm.Keyboard.KeyActions.CANCEL;
    });

    terminal.setCursorPosition(0, 0);
    terminal.setCursorVisible(true);
    terminal.runCommandClass(Crosh, params.getAll('args[]'));

    terminal.command.keyboard_ = terminal.keyboard;
  };
  terminal.onTerminalReady = function() {
    if (window.chrome && chrome.accessibilityFeatures &&
        chrome.accessibilityFeatures.spokenFeedback) {
      chrome.accessibilityFeatures.spokenFeedback.onChange.addListener(
          (details) => terminal.setAccessibilityEnabled(details.value));
      chrome.accessibilityFeatures.spokenFeedback.get({}, function(details) {
        terminal.setAccessibilityEnabled(details.value);
        runCrosh();
      });
    } else {
      runCrosh();
    }
  };

  terminal.contextMenu.setItems([
    [nassh.msg('TERMINAL_CLEAR_MENU_LABEL'),
     function() { terminal.wipeContents(); }],
    [nassh.msg('TERMINAL_RESET_MENU_LABEL'),
     function() { terminal.reset(); }],
    [nassh.msg('NEW_WINDOW_MENU_LABEL'),
     function() {
       // Preserve the full URI in case it has args like for vmshell.
       Crosh.openNewWindow_(document.location.href);
     }],
    [nassh.msg('FAQ_MENU_LABEL'),
     function() { lib.f.openWindow('https://goo.gl/muppJj', '_blank'); }],
    [nassh.msg('OPTIONS_BUTTON_LABEL'),
     function() { nassh.openOptionsPage(); }],
  ]);

  // Useful for console debugging.
  window.term_ = terminal;
  console.log(nassh.msg(
      'CONSOLE_CROSH_OPTIONS_NOTICE',
      ['Ctrl-Shift-P', lib.f.getURL('/html/nassh_preferences_editor.html')]));

  return true;
};

/**
 * Open a new session in a window.
 *
 * We use chrome.windows.create instead of lib.f.openWindow as the latter
 * might not always have permission to create a new window w/chrome=no.
 *
 * We can't rely on the background page all the time (like nassh_main.js) as we
 * might be executing as a bundled extension which doesn't have a background
 * page at all.
 *
 * @param {string} url The URL to open.
 * @returns {Promise} A promise resolving once the window opens.
 */
Crosh.openNewWindow_ = function(url) {
  return new Promise((resolve) => {
    chrome.windows.create({
      url: url,
      width: window.innerWidth,
      height: window.innerHeight,
      focused: true,
      type: 'popup',
    }, resolve);
  });
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
 * @param id Id of the process the event came from.
 * @param type Type of the event.
 *             'stdout': Process output detected.
 *             'exit': Process has exited.
 * @param text Text that was detected on process output.
**/
Crosh.prototype.onProcessOutput_ = function(id, type, text) {
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
 * Start the crosh command.
 *
 * This is invoked by the terminal as a result of terminal.runCommandClass().
 */
Crosh.prototype.run = function() {
  this.io = this.argv_.io.push();

  // We're not currently a window, so show a message to the user with a link to
  // open as a new window.
  if (hterm.windowType != 'popup') {
    const params = new URLSearchParams(document.location.search);
    params.set('openas', 'window');
    const url = new URL(document.location);
    url.search = params.toString();
    this.io.println(nassh.msg('OPEN_AS_WINDOW_TIP',
                              [`\x1b]8;;${url.href}\x07[crosh]\x1b]8;;\x07`]));
    this.io.println('');
  }

  if (!chrome.terminalPrivate) {
    this.io.println(nassh.msg('COMMAND_NOT_SUPPORTED', [this.commandName]));
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
      this.io.println(nassh.msg('COMMAND_STARTUP_FAILED',
                                [this.commandName, lib.f.lastError('')]));
      this.exit(1);
      return;
    }

    window.onbeforeunload = this.onBeforeUnload_.bind(this);
    this.id_ = id;

    // Setup initial window size.
    this.onTerminalResize_(this.io.terminal_.screenSize.width,
                           this.io.terminal_.screenSize.height);
  };

  // The optional arguments field is new to Chrome M65.  Once that goes stable
  // everywhere, we can drop this fallback logic.
  const args = this.argv_.argString;
  if (args.length)
    chrome.terminalPrivate.openTerminalProcess(this.commandName, args, pidInit);
  else
    chrome.terminalPrivate.openTerminalProcess(this.commandName, pidInit);
};

Crosh.prototype.onBeforeUnload_ = function(e) {
  // Note: This message doesn't seem to be shown by browsers.
  const msg = `Closing this tab will exit ${this.commandName}.`;
  e.returnValue = msg;
  return msg;
};

/**
 * Send a string to the crosh process.
 *
 * @param {string} string The string to send.
 */
Crosh.prototype.sendString_ = function(string) {
  if (this.id_ === null) {
    return;
  }
  chrome.terminalPrivate.sendInput(this.id_, string);
};

/**
 * Closes crosh terminal and exits the crosh command.
**/
Crosh.prototype.close_ = function() {
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
Crosh.prototype.onTerminalResize_ = function(width, height) {
  if (this.id_ === null) {
    return;
  }

  chrome.terminalPrivate.onTerminalResize(this.id_,
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

  this.io.println(nassh.msg('COMMAND_COMPLETE', [this.commandName, code]));
  this.io.println(nassh.msg('RECONNECT_MESSAGE'));
  this.io.onVTKeystroke = (string) => {
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
  };
};
