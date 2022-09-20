// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Initializes global state used in terminal.
 */

import {migrateFilesystemFromDomToIndexeddb} from './nassh_fs.js';

import {terminal} from './terminal.js';
import {definePrefs, registerOSInfoPreFetch, watchColors}
    from './terminal_common.js';
import './terminal_home_app.js';
import {getTerminalInfoTracker, setUpTitleHandler} from './terminal_info.js';

const globalInit = getTerminalInfoTracker().then((tracker) => {
  if (tracker.launchInfo.ssh?.needRedirect) {
    window.location.replace(new URL(
        '/html/terminal_ssh.html' + tracker.launchInfo.ssh.hash,
        window.location.href).toString());
    return;
  }
  // TODO(crbug.com/999028): Make sure system web apps are not discarded as
  // part of the lifecycle API.  This fix used by crosh and nassh is not
  // guaranteed to be a long term solution.
  chrome.tabs?.update(tracker.tabId, {autoDiscardable: false});

  return tracker;
});

/**
 * Run the logic to show the the terminal home page.
 */
function runTerminalHome() {
  window.storage = chrome.terminalPrivate
      ? new lib.Storage.TerminalPrivate() : new lib.Storage.Local();

  const prefs = window.preferenceManager = new hterm.PreferenceManager(
      window.storage);
  definePrefs(prefs);
  // Dynamically change colors if settings change.
  const setColorRgbCssVar = (name, color) => {
    const css = lib.notNull(lib.colors.normalizeCSS(color));
    const rgb = lib.colors.crackRGB(css).slice(0, 3).join(',');
    document.body.style.setProperty(`--${name}-rgb`, rgb);
  };
  ['background-color', 'cursor-color', 'foreground-color'].forEach((p) => {
    prefs.addObserver(p, setColorRgbCssVar.bind(null, p));
  });
  prefs.addObserver('color-palette-overrides', (v) => {
    // Use ANSI bright blue (12) for buttons.
    const c = lib.colors.normalizeCSS(v[12] || lib.colors.stockPalette[12]);
    setColorRgbCssVar('button-color', c);
  });
  watchColors(prefs);
  prefs.readStorage(() => {
    prefs.notifyAll();
    document.body.style.overflow = 'auto';
    document.body.appendChild(document.createElement('terminal-home-app'));
  });
  // Ctrl+Shift+N for new window, Ctrl+Shift+P for settings page.
  const keyMaps = {
    'N': () => chrome.terminalPrivate.openWindow(),
    'P': () => chrome.terminalPrivate.openOptionsPage(() => {}),
  };
  for (const [keyCode, f] of Object.entries(keyMaps)) {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.keyCode === keyCode.charCodeAt(0)) {
        f();
        e.preventDefault();
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  registerOSInfoPreFetch();

  // Load i18n messages.
  lib.registerInit('messages', async () => {
    // Load hterm.messageManager from /_locales/<lang>/messages.json.
    hterm.messageManager.useCrlf = true;
    const url = lib.f.getURL('/_locales/$1/messages.json');
    await hterm.messageManager.findAndLoadMessages(url);

    setUpTitleHandler(await globalInit);
  });

  lib.init().then(async () => {
    // Migrate over the DOM filesystem to the new indexeddb-fs.
    // TODO(vapier): Delete this with R110+.
    try {
      await migrateFilesystemFromDomToIndexeddb();
    } catch (e) {
      console.error('Error migrating filesystem', e);
    }

    const launchInfo = (await globalInit).launchInfo;
    if (launchInfo.home) {
      runTerminalHome();
      return;
    }

    const div = document.createElement('div');
    div.id = 'terminal';
    document.body.appendChild(div);
    window.term_ = await terminal.init(div, launchInfo);
  });
});
