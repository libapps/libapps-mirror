// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../../libdot/index.js';

import {hterm} from '../../hterm/index.js';

import {
  disableTabDiscarding, getSyncStorage, isCrOSSystemApp, loadWebFonts,
  openOptionsPage, osc8Link, sendFeedback, setupForWebApp, sgrText,
} from './nassh.js';

/**
 * CSP means that we can't kick off the initialization from the html file,
 * so we do it like this instead.
 */
globalThis.addEventListener('DOMContentLoaded', async (event) => {
  // If we're being opened by a link from another page, clear the opener setting
  // so we can't reach back into them.  They should have used noopener, but help
  // cover if they don't.
  if (globalThis.opener !== null) {
    globalThis.opener = null;
    globalThis.location.reload();
    return;
  }

  const params = new URLSearchParams(globalThis.location.search);

  // Make it easy to re-open as a window.
  const openas = params.get('openas');
  switch (openas) {
    case 'window': {
      // Delete the 'openas' string so we don't get into a loop.  We want to
      // preserve the rest of the query string when opening the window.
      params.delete('openas');
      const url = new URL(globalThis.location.toString());
      url.search = params.toString();
      Crosh.openNewWindow_(url.href).then(() => globalThis.close());
      return;
    }

    case 'fullscreen':
    case 'maximized':
      chrome.windows.getCurrent({populate: true}, (win) => {
        if (win.tabs.length > 1) {
          // If the current window has multiple tabs, create a new window and
          // move this tab to it.  This avoids confusion if the current window
          // has non-secure shell tabs in it.
          chrome.tabs.getCurrent((tab) => {
            chrome.windows.create({
              focused: win.focused,
              state: openas,
              tabId: tab.id,
            });
          });
        } else {
          // If the current window only has 1 tab, reuse the window.
          chrome.windows.update(win.id, {state: openas});
        }
      });
      break;
  }

  disableTabDiscarding();

  await setupForWebApp();

  Crosh.init();
});

/**
 * The Crosh-powered terminal command.
 *
 * This class defines a command that can be run in an hterm.Terminal instance.
 * The Crosh command uses terminalPrivate extension API to create and use crosh
 * process on ChromeOS machine.
 *
 * @param {{
 *   commandName: string,
 *   terminal: !hterm.Terminal,
 *   args: !Array<string>,
 * }} argv The argument object passed in from the Terminal.
 * @constructor
 */
function Crosh({commandName, terminal, args}) {
  this.commandName = commandName;
  this.terminal = terminal;
  this.io = terminal.io;
  this.args = args;
  this.id_ = null;
}

/**
 * The extension id of "crosh_builtin", the version of crosh that ships with
 * the ChromiumOS system image.
 */
Crosh.croshBuiltinId = 'nkoccljplnhpfnfiajclkommnmllphnl';

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
  const params = new URLSearchParams(globalThis.location.search);
  const profileId = params.get('profile');
  const storage = getSyncStorage();
  const terminal = new hterm.Terminal({profileId, storage});
  // Use legacy pasting when running as an extension to avoid prompt.
  // TODO(crbug.com/1063219) We need this to not prompt the user for clipboard
  // permission.
  terminal.alwaysUseLegacyPasting = !isCrOSSystemApp();

  // If we want to execute something other than the default crosh.
  // Since Terminal has shipped and supports Crostini now, we don't need to
  // support anything else, so hardcode crosh.
  const commandName = 'crosh';
  globalThis.document.title = commandName;

  terminal.decorate(lib.notNull(document.querySelector('#terminal')));
  terminal.installKeyboard();
  const runCrosh = function() {
    terminal.keyboard.bindings.addBinding('Ctrl+Shift+P', function() {
      openOptionsPage();
      return hterm.Keyboard.KeyActions.CANCEL;
    });

    terminal.onOpenOptionsPage = openOptionsPage;
    terminal.setCursorPosition(0, 0);
    terminal.setCursorVisible(true);
    const crosh = new Crosh({
      commandName,
      terminal,
      args: params.getAll('args[]'),
    });
    crosh.run();
  };
  terminal.onTerminalReady = function() {
    loadWebFonts(terminal.getDocument());

    // TODO(b/223076712): Avoid errors for nassh-crosh running on pre-M101.
    // Can be removed when stable is M101+.
    if (!chrome.terminalPrivate.getPrefs) {
      runCrosh();
      return;
    }

    const prefKey = 'settings.accessibility';
    const prefChanged = (prefs) => {
      if (prefs.hasOwnProperty(prefKey)) {
        terminal.setAccessibilityEnabled(prefs[prefKey]);
      }
    };
    chrome.terminalPrivate.onPrefChanged.addListener(prefChanged);
    chrome.terminalPrivate.getPrefs([prefKey], (prefs) => {
      prefChanged(prefs);
      runCrosh();
    });
  };

  terminal.contextMenu.setItems([
    {name: Crosh.msg('TERMINAL_CLEAR_MENU_LABEL'),
     action: function() { terminal.wipeContents(); }},
    {name: Crosh.msg('TERMINAL_RESET_MENU_LABEL'),
     action: function() { terminal.reset(); }},
    {name: Crosh.msg('NEW_WINDOW_MENU_LABEL'),
     action: function() {
       // Preserve the full URI in case it has args like for vmshell.
       Crosh.openNewWindow_(globalThis.location.href);
     }},
    {name: Crosh.msg('FAQ_MENU_LABEL'),
     action: function() {
       lib.f.openWindow('https://hterm.org/x/ssh/faq', '_blank');
     }},
    {name: Crosh.msg('HTERM_OPTIONS_BUTTON_LABEL'),
     action: function() { openOptionsPage(); }},
    {name: Crosh.msg('SEND_FEEDBACK_LABEL'),
     action: sendFeedback},
  ]);

  // Useful for console debugging.
  globalThis.term_ = terminal;

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
      width: globalThis.innerWidth,
      height: globalThis.innerHeight,
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
 * @param {string|!ArrayBuffer} data Data that was detected on process output.
 */
Crosh.prototype.onProcessOutput_ = function(id, type, data) {
  if (this.id_ === null || id !== this.id_) {
    return;
  }

  if (type == 'exit') {
    this.exit(0);
    return;
  }
  if (data instanceof ArrayBuffer) {
    this.io.writeUTF8(data);
  } else {
    // Older version of terminal private api gives strings.
    //
    // TODO(1260289): Remove this.
    this.io.print(data);
  }
};

/**
 * Start the crosh command.
 */
Crosh.prototype.run = function() {
  // We're not currently a window, so show a message to the user with a link to
  // open as a new window.
  if (hterm.windowType !== 'app' &&
      hterm.windowType !== 'popup' &&
      !isCrOSSystemApp()) {
    const params = new URLSearchParams(globalThis.location.search);
    params.set('openas', 'window');
    const url = new URL(globalThis.location.toString());
    url.search = params.toString();
    this.io.println(Crosh.msg(
        'OPEN_AS_WINDOW_TIP',
        [sgrText(osc8Link(url.href, '[crosh]'), {bold: true})]));
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

    globalThis.onbeforeunload = this.onBeforeUnload_.bind(this);
    this.id_ = id;

    // Setup initial window size.
    this.onTerminalResize_(this.io.terminal_.screenSize.width,
                           this.io.terminal_.screenSize.height);
  };

  chrome.terminalPrivate.openTerminalProcess(
      this.commandName, this.args, pidInit);
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
  globalThis.onbeforeunload = null;

  const onExit = () => {
    if (this.terminal.getPrefs().get('close-on-exit')) {
      globalThis.close();
    }
  };

  if (code == 0) {
    onExit();
    return;
  }

  this.io.println(Crosh.msg('COMMAND_COMPLETE', [this.commandName, code]));
  this.io.println(Crosh.msg('RECONNECT_MESSAGE'));
  this.io.onVTKeystroke = (string) => {
    const ch = string.toLowerCase();
    if (ch == 'r' || ch == ' ' || ch == '\x0d' /* enter */ ||
        ch == '\x12' /* ctrl-r */) {
      globalThis.location.reload();
      return;
    }

    if (ch == 'c') {
      globalThis.location.replace('/html/nassh_connect_dialog.html');
      return;
    }

    if (ch == 'e' || ch == 'x' || ch == '\x1b' /* ESC */ ||
        ch == '\x17' /* C-w */) {
      onExit();
    }
  };
};
