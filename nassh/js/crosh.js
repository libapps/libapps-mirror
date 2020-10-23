// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * CSP means that we can't kick off the initialization from the html file,
 * so we do it like this instead.
 */
window.addEventListener('DOMContentLoaded', (event) => {
  // Workaround https://crbug.com/928045.
  if (nassh.workaroundMissingChromeRuntime()) {
    return;
  }

  const params = new URLSearchParams(document.location.search);

  // Make it easy to re-open as a window.
  const openas = params.get('openas');
  switch (openas) {
    case 'window': {
      // Delete the 'openas' string so we don't get into a loop.  We want to
      // preserve the rest of the query string when opening the window.
      params.delete('openas');
      const url = new URL(document.location.toString());
      url.search = params.toString();
      Crosh.openNewWindow_(url.href).then(() => window.close());
      return;
    }

    case 'fullscreen':
    case 'maximized':
      chrome.windows.getCurrent((win) => {
        chrome.windows.update(win.id, {state: openas});
      });
      break;
  }

  nassh.disableTabDiscarding();

  // Modifications if crosh is running as a web app.
  if (Crosh.isWebApp()) {
    lib.registerInit('terminal-private-storage', () => {
      hterm.defaultStorage = new lib.Storage.TerminalPrivate();
    });
    lib.registerInit('messages', nassh.loadMessages);
  }

  lib.init().then(Crosh.init);
});

/**
 * The Crosh-powered terminal command.
 *
 * This class defines a command that can be run in an hterm.Terminal instance.
 * The Crosh command uses terminalPrivate extension API to create and use crosh
 * process on Chrome OS machine.
 *
 * @param {{
     commandName: string,
 *   args: !Array<string>,
 * }} argv The argument object passed in from the Terminal.
 * @constructor
 */
function Crosh(argv) {
  this.commandName = argv.commandName;
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
 * Returns true if this is running as a web app in
 * chrome-untrusted://[crosh|terminal]/, or false if this is running as a nassh
 * app/extension.
 *
 * @return {boolean}
 */
Crosh.isWebApp = function() {
  return location.href.startsWith('chrome-untrusted://');
};

/**
 * Return a formatted message in the current locale.
 *
 * @param {string} name The name of the message to return.
 * @param {!Array=} args The message arguments, if required.
 * @return {string} The localized & formatted message.
 */
Crosh.msg = function(name, args) {
  return hterm.messageManager.get(name, args);
};

/**
 * Static initializer called from crosh.html.
 *
 * This constructs a new Terminal instance and instructs it to run the Crosh
 * command.
 *
 * @return {boolean}
 */
Crosh.init = function() {
  const params = new URLSearchParams(document.location.search);
  const profileId = params.get('profile');
  const terminal = new hterm.Terminal({profileId});
  // Use legacy pasting when running as an extension to avoid prompt.
  // TODO(crbug.com/1063219) We need this to not prompt the user for clipboard
  // permission.
  terminal.alwaysUseLegacyPasting = !Crosh.isWebApp();

  // If we want to execute something other than the default crosh.
  const commandName = params.get('command') || 'crosh';
  window.document.title = commandName;

  terminal.decorate(lib.notNull(document.querySelector('#terminal')));
  const runCrosh = function() {
    terminal.keyboard.bindings.addBinding('Ctrl+Shift+P', function() {
      nassh.openOptionsPage();
      return hterm.Keyboard.KeyActions.CANCEL;
    });

    terminal.onOpenOptionsPage = nassh.openOptionsPage;
    terminal.setCursorPosition(0, 0);
    terminal.setCursorVisible(true);
    terminal.runCommandClass(Crosh, commandName, params.getAll('args[]'));

    terminal.command.keyboard_ = terminal.keyboard;
  };
  terminal.onTerminalReady = function() {
    nassh.loadWebFonts(terminal.getDocument());
    // TODO(crbug.com/1019034): chrome.terminalPrivate a11y was added in M82.
    // We can migrate fully to it and remove chrome.accessibilityFeatures once
    // M82 is stable.
    if (chrome.terminalPrivate.onA11yStatusChanged &&
        chrome.terminalPrivate.getA11yStatus) {
      chrome.terminalPrivate.onA11yStatusChanged.addListener(
          (enabled) => terminal.setAccessibilityEnabled(enabled));
      chrome.terminalPrivate.getA11yStatus((enabled) => {
        terminal.setAccessibilityEnabled(enabled);
          runCrosh();
        });
    } else if (
        chrome.accessibilityFeatures &&
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
    {name: Crosh.msg('TERMINAL_CLEAR_MENU_LABEL'),
     action: function() { terminal.wipeContents(); }},
    {name: Crosh.msg('TERMINAL_RESET_MENU_LABEL'),
     action: function() { terminal.reset(); }},
    {name: Crosh.msg('NEW_WINDOW_MENU_LABEL'),
     action: function() {
       // Preserve the full URI in case it has args like for vmshell.
       Crosh.openNewWindow_(document.location.href);
     }},
    {name: Crosh.msg('FAQ_MENU_LABEL'),
     action: function() {
       lib.f.openWindow('https://goo.gl/muppJj', '_blank');
     }},
    {name: Crosh.msg('HTERM_OPTIONS_BUTTON_LABEL'),
     action: function() { nassh.openOptionsPage(); }},
    {name: Crosh.msg('SEND_FEEDBACK_LABEL'),
     action: nassh.sendFeedback},
  ]);

  // Useful for console debugging.
  window.term_ = terminal;
  console.log(Crosh.msg(
      'CONSOLE_CROSH_OPTIONS_NOTICE',
      ['Ctrl+Shift+P', lib.f.getURL('/html/nassh_preferences_editor.html')]));

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
 * @return {!Promise} A promise resolving once the window opens.
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
 * Called when an event from the crosh process is detected.
 *
 * @param {string} id Id of the process the event came from.
 * @param {string} type Type of the event.
 *             'stdout': Process output detected.
 *             'exit': Process has exited.
 * @param {string} text Text that was detected on process output.
 */
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
  if (hterm.windowType != 'popup' && !Crosh.isWebApp()) {
    const params = new URLSearchParams(document.location.search);
    params.set('openas', 'window');
    const url = new URL(document.location.toString());
    url.search = params.toString();
    this.io.println(Crosh.msg(
        'OPEN_AS_WINDOW_TIP',
        [nassh.sgrText(nassh.osc8Link(url.href, '[crosh]'), {bold: true})]));
    this.io.println('');
  }

  if (!chrome.terminalPrivate) {
    this.io.println(Crosh.msg('COMMAND_NOT_SUPPORTED', [this.commandName]));
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
      this.io.println(Crosh.msg('COMMAND_STARTUP_FAILED',
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

  chrome.terminalPrivate.openTerminalProcess(
      this.commandName, this.argv_.args, pidInit);
};

/**
 * Registers with window.onbeforeunload and runs when page is unloading.
 *
 * @param {?Event} e Before unload event.
 * @return {string} Message to display.
 */
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
 */
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
 * @param {string|number} width The new terminal width.
 * @param {string|number} height The new terminal height.
 */
Crosh.prototype.onTerminalResize_ = function(width, height) {
  if (this.id_ === null) {
    return;
  }

  chrome.terminalPrivate.onTerminalResize(this.id_,
      Number(width), Number(height),
      function(success) {
        if (!success) {
          console.warn('terminalPrivate.onTerminalResize failed');
        }
      },
  );
};

/**
 * Exit the crosh command.
 *
 * @param {number} code Exit code, 0 for success.
 */
Crosh.prototype.exit = function(code) {
  this.close_();
  window.onbeforeunload = null;

  if (code == 0) {
    this.io.pop();
    if (this.argv_.onExit) {
      this.argv_.onExit(code);
    }
    return;
  }

  this.io.println(Crosh.msg('COMMAND_COMPLETE', [this.commandName, code]));
  this.io.println(Crosh.msg('RECONNECT_MESSAGE'));
  this.io.onVTKeystroke = (string) => {
    const ch = string.toLowerCase();
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
      if (this.argv_.onExit) {
        this.argv_.onExit(code);
      }
    }
  };
};
