// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview
 * @suppress {moduleLoad}
 */

import {hterm, lib} from './deps_local.concat.js';

import {composeTmuxUrl, getOSInfo, watchColors} from './terminal_common.js';
import {createEmulator} from './terminal_emulator.js';
import {terminalImport} from './terminal_import.js';
import {LaunchInfo, SSHLaunchInfo, getTerminalInfoTracker}
    from './terminal_info.js';
import {ClientWindow as TmuxClientWindow, TmuxControllerDriver}
    from './terminal_tmux.js';

export const terminal = {};

/** @type {!lib.PreferenceManager} */
window.preferenceManager;

/**
 * The Terminal command.
 *
 * The Terminal command uses the terminalPrivate extension API to create and
 * use the vmshell process on a ChromeOS machine.
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
 * Static initializer.
 *
 * This constructs a new hterm.Terminal instance and instructs it to run
 * the Terminal command.
 *
 * @param {!Element} element The element that is to be decorated.
 * @param {!LaunchInfo} launchInfo launch info.
 * @return {!Promise<!hterm.Terminal>} The new hterm.Terminal instance.
 */
terminal.init = async function(element, launchInfo) {
  const profileId = launchInfo.settingsProfileId ||
      hterm.Terminal.DEFAULT_PROFILE_ID;

  const storage = new lib.Storage.TerminalPrivate();
  const term = await createEmulator({storage, profileId});

  term.decorate(element);
  term.installKeyboard();
  watchColors(term.getPrefs());
  const runTerminal = async function() {
    term.onOpenOptionsPage = terminal.openOptionsPage;

    /** @type {?TmuxControllerDriver} */
    let tmuxControllerDriver = null;

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
        runNassh(term, storage, launchInfo.ssh, tmuxControllerDriver);
      }
      return;
    }

    const terminalCommand = new terminal.Command(term);
    terminalCommand.run(launchInfo);
  };

  term.onTerminalReady = function() {
    // TODO(lxj): remove this after we drop hterm support.
    term.handleOnTerminalReady();

    const prefKey = 'settings.accessibility';
    const prefChanged = (prefs) => {
      if (prefs.hasOwnProperty(prefKey)) {
        term.setAccessibilityEnabled(prefs[prefKey] || !!getOSInfo().tast);
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
    const args = [`--startup_id=${this.id_}`, ...launchInfo.vsh.args];
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
 * @param {!hterm.Terminal} term
 * @param {!lib.Storage} storage
 * @param {!SSHLaunchInfo} ssh
 * @param {?TmuxControllerDriver} tmuxControllerDriver
 */
async function runNassh(term, storage, ssh, tmuxControllerDriver) {
  // Load nassh modules and ensure gnubby extension lookup is complete.
  const {CommandInstance} = await terminalImport('./nassh_command_instance.js');

  const profileId = ssh.hash.substr(1);
  let fsp;
  let sftpStartupCallback;
  let mountOptions;

  if (ssh.isMount) {
    const {SftpFsp} = await terminalImport('./nassh_sftp_fsp.js');
    const {PreferenceManager} =
        await terminalImport('./nassh_preference_manager.js');
    fsp = new SftpFsp();
    fsp.addListeners();

    const id = profileId.split(':')[1] || profileId;
    const prefs = new PreferenceManager(storage);
    await new Promise((resolve) => prefs.readStorage(resolve));
    const profile = prefs.getProfile(id);
    const displayName = profile.getString('description');
    mountOptions = {fileSystemId: id, displayName, writable: true};
    sftpStartupCallback = (success, message) => {
      if (!success) {
        term.io.showOverlay(message, null);
      } else {
        const mountedMsg = document.createElement('div');
        mountedMsg.innerHTML = `
          <h3>${terminal.msg('MOUNTED_MESSAGE')}</h3>
          ${terminal.msg('TERMINAL_HOME_MOUNTED_TAB_CLOSE_MESSAGE')}
          <p>`;
        document.body.appendChild(mountedMsg);
        term.io.showOverlay(mountedMsg, null);
        window.addEventListener('beforeunload', () => {
          fsp.unmount(id);
        });
      }
    };
  }

  let environment = term.getPrefs().get('environment');
  if (typeof environment !== 'object' || environment === null) {
    environment = {};
  }

  const nasshCommand = new CommandInstance({
    io: term.io,
    syncStorage: new lib.Storage.TerminalPrivate(),
    args: [profileId],
    environment: environment,
    isSftp: ssh.isMount || ssh.isSftp,
    sftpStartupCallback,
    isMount: ssh.isMount,
    basePath: ssh.mountPath,
    fsp,
    mountOptions,
    onExit: async (code) => {
      term.uninstallKeyboard();
      if (!ssh.isMount && term.getPrefs().get('close-on-exit')) {
        // We are not able to use `window.close()` here because 1) nassh
        // redirect the page and 2) blink forbids `window.close()` when the
        // history length > 1. See
        // http://osscs/chromium/chromium/src/+/main:third_party/blink/renderer/core/frame/dom_window.cc;l=405;drc=9e5ff859e6b26ac78137c41178631fac938cf751
        chrome.tabs.remove((await getTerminalInfoTracker()).tabId);
      }
    },
  });

  if (tmuxControllerDriver) {
    nasshCommand.onPluginExit = async () => {
      if (tmuxControllerDriver.active) {
        // Send ST to end the ongoing DCS sequence.
        await new Promise((resolve) => term.write('\x1b\\', resolve));
      }
    };
  }

  nasshCommand.run();
}
