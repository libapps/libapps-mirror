// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview The main nassh runtime.
 * @suppress {moduleLoad}
 */

import {lib} from '../../libdot/index.js';

import {hterm} from '../../hterm/index.js';

import {cleanupChromeSockets} from '../wassh/js/sockets.js';

import {
  disableTabDiscarding, getSyncStorage, loadWebFonts, localize,
  openOptionsPage, runtimeSendMessage, sendFeedback, setupForWebApp,
  watchBackgroundColor,
} from './nassh.js';
import {CommandInstance} from './nassh_command_instance.js';

/**
 * Open a new window to the specified URL.
 *
 * We have to go through the background page in order to set chrome=no.
 * Normally Chrome will ignore it (for security reasons) when run in a
 * webpage or tab.  Extensions/apps are allowed to though, so grab the
 * background page and let it do the open for us.
 *
 * @param {string} url The URL to open.
 * @return {!Promise} A promise resolving once the window opens.
 */
const openNewWindow = function(url) {
  const msg = {
    command: 'nassh',
    width: globalThis.innerWidth,
    height: globalThis.innerHeight,
    url: url,
    window: true,
  };
  return runtimeSendMessage(msg).then((response) => {
    if (response && response.error) {
      throw new Error(`request failed: ${response.message}`);
    }
  });
};

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

  // Check if site's storage has been marked as persistent.
  if (globalThis.navigator?.storage?.persist &&
      globalThis.navigator?.storage?.persisted) {
    if (!await navigator.storage.persisted()) {
      // Request persistent storage for site.
      const isPersisted = await navigator.storage.persist();
      if (!isPersisted) {
        console.warn('Failed to request persistent storage.');
      }
    }
  }

  const params = new URLSearchParams(globalThis.location.search);

  // Allow users to bookmark links that open as a window.
  const openas = params.get('openas');
  switch (openas) {
    case 'window': {
      // Delete the 'openas' string so we don't get into a loop.  We want to
      // preserve the rest of the query string when opening the window.
      params.delete('openas');
      const url = new URL(globalThis.location.toString());
      url.search = params.toString();
      openNewWindow(url.href).then(() => globalThis.close);
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

  const execNaSSH = function() {
    const profileId = params.get('profile');
    const storage = getSyncStorage();

    const terminal = new hterm.Terminal({profileId, storage});
    // TODO(crbug.com/1063219) We need this to not prompt the user for clipboard
    // permission.
    terminal.alwaysUseLegacyPasting = true;
    terminal.decorate(lib.notNull(document.querySelector('#terminal')));
    terminal.installKeyboard();
    const runNassh = function() {
      terminal.onOpenNewSession = function() {
        openNewWindow(lib.f.getURL('/html/nassh_connect_dialog.html'));
      };
      terminal.onOpenOptionsPage = openOptionsPage;
      terminal.setCursorPosition(0, 0);
      terminal.setCursorVisible(true);

      let environment = terminal.getPrefs().get('environment');
      if (typeof environment !== 'object' || environment === null) {
        environment = {};
      }

      // If the connection profile isn't passed via the hash, check the query
      // string for profile-id= override.
      let argstr = globalThis.location.hash.substr(1);
      if (argstr === '') {
        const nasshProfileId = params.get('profile-id');
        if (nasshProfileId !== null) {
          argstr = `profile-id:${nasshProfileId}`;
        }
      }
      const nasshCommand = new CommandInstance({
        io: terminal.io,
        syncStorage: storage,
        args: [argstr],
        environment: environment,
        onExit: (code) => {
          if (terminal.getPrefs().get('close-on-exit')) {
            globalThis.close();
          }
        },
      });
      nasshCommand.run();
    };
    terminal.onTerminalReady = function() {
      watchBackgroundColor(terminal.getPrefs());
      loadWebFonts(terminal.getDocument());
      if (globalThis.chrome?.accessibilityFeatures?.spokenFeedback) {
        chrome.accessibilityFeatures.spokenFeedback.onChange.addListener(
            (details) => terminal.setAccessibilityEnabled(details.value));
        chrome.accessibilityFeatures.spokenFeedback.get({}, (details) => {
          // In case it fails, don't break startup.
          if (details) {
            terminal.setAccessibilityEnabled(details.value);
          }
          runNassh();
        });
      } else {
        runNassh();
      }
    };

    terminal.contextMenu.setItems([
      {name: localize('TERMINAL_CLEAR_MENU_LABEL'),
       action: function() { terminal.wipeContents(); }},
      {name: localize('TERMINAL_RESET_MENU_LABEL'),
       action: function() { terminal.reset(); }},
      {name: localize('NEW_WINDOW_MENU_LABEL'),
       action: function() {
         openNewWindow(lib.f.getURL('/html/nassh_connect_dialog.html'));
       }},
      {name: localize('FAQ_MENU_LABEL'),
       action: function() {
         lib.f.openWindow('https://hterm.org/x/ssh/faq', '_blank');
       }},
      {name: localize('CLEAR_KNOWN_HOSTS_MENU_LABEL'),
       action: function() { openOptionsPage('ssh-files'); }},
      {name: localize('HTERM_OPTIONS_BUTTON_LABEL'),
       action: function() { openOptionsPage(); }},
      {name: localize('SEND_FEEDBACK_LABEL'),
       action: sendFeedback},
    ]);

    // Useful for console debugging.
    globalThis.term_ = terminal;
  };

  await cleanupChromeSockets();
  disableTabDiscarding();
  await setupForWebApp();
  execNaSSH();
});
