// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview
 * @suppress {moduleLoad}
 */

import {composeTmuxUrl, definePrefs, getOSInfo, loadPowerlineWebFonts,
  loadWebFont, normalizeCSSFontFamily, watchColors} from './terminal_common.js';
import {terminalImport} from './terminal_import.js';
import {LaunchInfo, getTerminalInfoTracker} from './terminal_info.js';
import {ClientWindow as TmuxClientWindow, TmuxControllerDriver}
    from './terminal_tmux.js';

export const terminal = {};

/** @type {!lib.PreferenceManager} */
window.preferenceManager;

/**
 * The Terminal command.
 *
 * The Terminal command uses the terminalPrivate extension API to create and
 * use the vmshell process on a Chrome OS machine.
 *
 * @param {!hterm.Terminal} term
 * @constructor
 */
terminal.Command = function(term) {
  this.term_ = term;
  this.io_ = this.term_.io;
  // We pass this ID to chrome to use for startup text which is sent before the
  // vsh process is created and we receive an ID from openVmShellProcess.
  this.id_ = Math.random().toString().substring(2);
  this.isFirstOutput_ = false;
};

/**
 * Return a formatted message in the current locale.
 *
 * @param {string} name The name of the message to return.
 * @param {!Array=} args The message arguments, if required.
 * @return {string} The localized & formatted message.
 */
terminal.msg = function(name, args) {
  return hterm.messageManager.get(name, args);
};

/**
 * Create a new window to the options page for customizing preferences.
 */
terminal.openOptionsPage = function() {
  chrome.terminalPrivate.openOptionsPage(() => {});
};

/**
 * Either send a ^N or open a new tabbed terminal window.
 *
 * @this {!hterm.Keyboard.KeyMap}
 * @param {!KeyboardEvent} e The event to process.
 * @param {!hterm.Keyboard.KeyDef} k
 * @return {!hterm.Keyboard.KeyDefFunction|string} Key action or sequence.
 */
terminal.onCtrlN = function(e, k) {
  if (e.shiftKey || this.keyboard.terminal.passCtrlN) {
    return function(e, k) {
      chrome.terminalPrivate.openWindow();
      return hterm.Keyboard.KeyActions.CANCEL;
    };
  }

  return '\x0e';
};

/**
 * Adds bindings for terminal such as options page and some extra Chrome OS
 * system key bindings when 'keybindings-os-defaults' pref is set. Reloads
 * current bindings if needed.
 *
 * @param {!hterm.Terminal} term
 */
terminal.addBindings = function(term) {
  Object.assign(hterm.Keyboard.Bindings.OsDefaults['cros'], {
    // Dock window left/right.
    'Alt+BRACKET_LEFT': 'PASS',
    'Alt+BRACKET_RIGHT': 'PASS',
    // Maximize/minimize window.
    'Alt+EQUAL': 'PASS',
    'Alt+MINUS': 'PASS',
  });
  if (term.getPrefs().get('keybindings-os-defaults')) {
    term.keyboard.bindings.clear();
    term.keyboard.bindings.addBindings(
        /** @type {!Object} */ (term.getPrefs().get('keybindings') || {}),
        true);
  }

  term.keyboard.bindings.addBinding('Ctrl+Shift+P', function() {
    terminal.openOptionsPage();
    return hterm.Keyboard.KeyActions.CANCEL;
  });
};

/**
 * Static initializer.
 *
 * This constructs a new hterm.Terminal instance and instructs it to run
 * the Terminal command.
 *
 * @param {!Element} element The element that is to be decorated.
 * @param {!LaunchInfo} launchInfo launch info.
 * @return {!hterm.Terminal} The new hterm.Terminal instance.
 */
terminal.init = function(element, launchInfo) {
  const profileId = launchInfo.settingsProfileId ||
      hterm.Terminal.DEFAULT_PROFILE_ID;
  const term = new hterm.Terminal(
      {profileId, storage: new lib.Storage.TerminalPrivate()});

  term.decorate(element);
  term.installKeyboard();
  watchColors(term.getPrefs());
  const runTerminal = async function() {
    term.onOpenOptionsPage = terminal.openOptionsPage;
    term.keyboard.keyMap.keyDefs[78].control = terminal.onCtrlN;
    terminal.addBindings(term);
    term.setCursorPosition(0, 0);
    term.setCursorVisible(true);

    /** @type {?TmuxControllerDriver} */
    let tmuxControllerDriver = null;

    if (getOSInfo().tmux_integration) {
      tmuxControllerDriver = new TmuxControllerDriver({
        term,
        onOpenWindow: ({driver, channelName}) => {
          chrome.terminalPrivate.openWindow({
            url: composeTmuxUrl({
              windowChannelName: channelName,
              driverChannelName: driver.channelName,
              settingsProfileId: launchInfo.settingsProfileId,
            }),
            asTab: true,
          });
        },
      });
      tmuxControllerDriver.install();
    }

    if (launchInfo.tmux) {
      const {windowChannelName, driverChannelName} = launchInfo.tmux;
      if (windowChannelName) {
        /* eslint-disable-next-line no-new */
        new TmuxClientWindow({
          channelName: windowChannelName,
          term,
        });
        return;
      }

      // There is no window channel name. This happens when we are at a new tab,
      // and the parent tab is a tmux window. We should open a new tmux window
      // for the tab.
      //
      // TODO(1252271): When we are running vsh, new tab will follow the CWD of
      // the current tab. We might want to do the same for tmux.
      try {
        await TmuxClientWindow.open({driverChannelName, term});
      } catch (error) {
        // TODO(1252271): i18n this.
        term.print(`Failed to connect to the tmux process: ` +
            error.toString());
      }
      return;
    }

    if (launchInfo.ssh) {
      // We handle the needRedirect case in another place.
      if (!launchInfo.ssh.needRedirect) {
        runNassh(term, launchInfo.ssh.hash, tmuxControllerDriver);
      }
      return;
    }

    const terminalCommand = new terminal.Command(term);
    terminalCommand.run(launchInfo);
  };

  term.onTerminalReady = function() {
    const prefs = term.getPrefs();
    definePrefs(prefs);
    terminal.watchBackgroundImage(term);

    loadPowerlineWebFonts(term.getDocument());
    const onFontFamilyChanged = async (cssFontFamily) => {
      const fontFamily = normalizeCSSFontFamily(cssFontFamily);
      // If the user changes font quickly enough, we might have a pending
      // loadWebFont() task, but it should be harmless. Potentially, we can
      // implement a cancellable promise so that we can cancel it.
      try {
        await loadWebFont(term.getDocument(), fontFamily);
      } catch (error) {
        /* eslint-disable-next-line no-new */
        new Notification(
            terminal.msg('TERMINAL_FONT_UNAVAILABLE', [fontFamily]),
            {
              body: terminal.msg('TERMINAL_TRY_AGAIN_WITH_INTERNET'),
              tag: 'TERMINAL_FONT_UNAVAILABLE',
            },
        );
      }
    };
    onFontFamilyChanged(prefs.get('font-family'));
    prefs.addObserver('font-family', onFontFamilyChanged);

    const prefKey = 'settings.accessibility';
    const prefChanged = (prefs) => {
      if (prefs.hasOwnProperty(prefKey)) {
        term.setAccessibilityEnabled(prefs[prefKey]);
      }
    };
    chrome.terminalPrivate.onPrefChanged.addListener(prefChanged);
    chrome.terminalPrivate.getPrefs([prefKey], (prefs) => {
      prefChanged(prefs);
      runTerminal();
    });
  };

  term.contextMenu.setItems([
    {name: terminal.msg('TERMINAL_CLEAR_MENU_LABEL'),
     action: function() { term.wipeContents(); }},
    {name: terminal.msg('TERMINAL_RESET_MENU_LABEL'),
     action: function() { term.reset(); }},
    {name: terminal.msg('TERMINAL_TITLE_SETTINGS'),
     action: function() { terminal.openOptionsPage(); }},
  ]);

  return term;
};

/**
 * Called when an event from the vmshell process is detected.
 *
 * @param {string} id Id of the process the event came from.
 * @param {string} type Type of the event.
 *             'stdout': Process output detected.
 *             'exit': Process has exited.
 * @param {string|!ArrayBuffer} data Data that was detected on process output.
 */
terminal.Command.prototype.onProcessOutput_ = function(id, type, data) {
  if (id !== this.id_) {
    return;
  }

  // When terminal starts, the first message may be type 'exit' if the process
  // fails to start.  In this case, we don't want to close the tab since we
  // can display an error message to the user.
  if (type == 'exit' && !this.isFirstOutput_) {
    this.exit(0);
    return;
  }

  if (data instanceof ArrayBuffer) {
    this.io_.writeUTF8(data);
  } else {
    // Older version of terminal private api gives strings.
    //
    // TODO(1260289): Remove this.
    this.io_.print(data);
  }
  this.isFirstOutput_ = false;
};

/**
 * Start the terminal command.
 *
 * @param {!LaunchInfo} launchInfo
 */
terminal.Command.prototype.run = function(launchInfo) {
  if (!chrome.terminalPrivate) {
    this.io_.println(
        'Launching terminal failed: chrome.terminalPrivate not found');
    this.exit(1);
    return;
  }

  chrome.terminalPrivate.onProcessOutput.addListener(
      this.onProcessOutput_.bind(this));

  const pidInit = (id) => {
    if (id === undefined) {
      this.io_.println(
          `Launching vmshell failed: ${lib.f.lastError('')}`);
      this.exit(1);
      return;
    }

    window.onbeforeunload = this.onBeforeUnload_.bind(this);
    this.id_ = id;
    this.isFirstOutput_ = true;

    this.io_.onVTKeystroke = this.io_.sendString = this.sendString_.bind(this);
    this.io_.onTerminalResize = this.onTerminalResize_.bind(this);
    document.body.onunload = this.close_.bind(this);

    // Setup initial window size.
    this.onTerminalResize_(
        this.io_.terminal_.screenSize.width,
        this.io_.terminal_.screenSize.height);
  };

  if (launchInfo.crosh) {
    chrome.terminalPrivate.openTerminalProcess('crosh', [], pidInit);
  } else {
    const args = [...launchInfo.vsh.args, `--startup_id=${this.id_}`];
    chrome.terminalPrivate.openVmshellProcess(args, (id) => {
      pidInit(id);
      launchInfo.vsh.terminalId = id;
    });
  }
};

/**
 * Registers with window.onbeforeunload and runs when page is unloading.
 *
 * @param {?Event} e Before unload event.
 */
terminal.Command.prototype.onBeforeUnload_ = function(e) {
  // Set e.returnValue to any string for chrome to display a warning.
  e.returnValue = '';
};

/**
 * Send a string to the terminal process.
 *
 * @param {string} string The string to send.
 */
terminal.Command.prototype.sendString_ = function(string) {
  chrome.terminalPrivate.sendInput(this.id_, string);
};

/**
 * Closes the terminal and exits the command.
 */
terminal.Command.prototype.close_ = function() {
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
  chrome.terminalPrivate.onTerminalResize(
      this.id_, Number(width), Number(height), function(success) {
        if (!success) {
          console.warn('terminalPrivate.onTerminalResize failed');
        }
      });
};

/**
 * Exit the terminal command.
 *
 * @param {number} code Exit code, 0 for success.
 */
terminal.Command.prototype.exit = function(code) {
  this.close_();
  window.onbeforeunload = null;

  if (code === 0 && this.term_.getPrefs().get('close-on-exit')) {
    window.close();
  }
};

/**
 * Set background image from local storage if exists, else use pref.
 *
 * @param {!hterm.Terminal} term
 */
terminal.watchBackgroundImage = function(term) {
  const key = 'background-image';
  const setBackgroundImage = (dataUrl) => {
    term.setBackgroundImage(
        dataUrl ? `url(${dataUrl})` : term.getPrefs().getString(key));
  };
  setBackgroundImage(window.localStorage.getItem(key));
  window.addEventListener('storage', (e) => {
    if (e.key === key) {
      setBackgroundImage(e.newValue);
    }
  });
  // hterm also observers pref, but we register after it, so we run after it,
  // so terminal will always use a file from localStorage if it exists.
  term.getPrefs().addObserver(key, () => {
    setBackgroundImage(window.localStorage.getItem(key));
  });
};

/**
 * @param {!hterm.Terminal} term
 * @param {string} hash This is normally taken from the url's hash. It looks
 *     like '#profile-id:xxxx'.
 * @param {?TmuxControllerDriver} tmuxControllerDriver
 */
async function runNassh(term, hash, tmuxControllerDriver) {
  // Load nassh modules and ensure gnubby extension lookup is complete.
  const {CommandInstance} = await terminalImport('./nassh_command_instance.js');
  await lib.init();

  let environment = term.getPrefs().get('environment');
  if (typeof environment !== 'object' || environment === null) {
    environment = {};
  }

  /** @suppress {undefinedVars|missingProperties} */
  const nasshCommand = new CommandInstance({
    io: term.io,
    syncStorage: new lib.Storage.TerminalPrivate(),
    args: [hash.substr(1)],
    environment: environment,
    onExit: async (code) => {
      if (term.getPrefs().get('close-on-exit')) {
        // We are not able to use `window.close()` here because 1) nassh
        // redirect the page and 2) blink forbids `window.close()` when the
        // history length > 1. See
        // http://osscs/chromium/chromium/src/+/main:third_party/blink/renderer/core/frame/dom_window.cc;l=405;drc=9e5ff859e6b26ac78137c41178631fac938cf751
        chrome.tabs.remove((await getTerminalInfoTracker()).tabId);
      }
    },
  });

  nasshCommand.resetTerminal = () => {
    term.reset();
    // This is necessary to get us out of tmux mode if we are in one.
    term.vt.resetParseState();
    return true;
  };
  if (tmuxControllerDriver) {
    nasshCommand.onPluginExit = () => {
      tmuxControllerDriver.reset();
    };
  }

  nasshCommand.run();
}
