// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Initializes global state used in terminal home page.
 */

import {terminal} from './terminal.js';
import {definePrefs} from './terminal_common.js';

let resolveLibdotInitialized;
window.libdotInitialized = new Promise((resolve) => {
  resolveLibdotInitialized = resolve;
});

hterm.defaultStorage = chrome.terminalPrivate
  ? new lib.Storage.TerminalPrivate() : new lib.Storage.Local();

window.addEventListener('DOMContentLoaded', (event) => {
  // Load i18n messages.
  lib.registerInit('messages', async () => {
    // Load hterm.messageManager from /_locales/<lang>/messages.json.
    // Set "useCrlf" to match how the terminal is using it, although we don't
    // actually need it for settings.
    hterm.messageManager.useCrlf = true;
    const url = lib.f.getURL('/_locales/$1/messages.json');
    await hterm.messageManager.findAndLoadMessages(url);
    document.title = hterm.messageManager.get('TERMINAL_TITLE_TERMINAL');
  });
  lib.init().then(() => {
    const prefs = window.preferenceManager = new hterm.PreferenceManager();
    definePrefs(prefs);
    ['cursor-color', 'foreground-color'].forEach((p) => {
      prefs.addObserver(p, (color) => {
        document.body.style.setProperty(
            `--hterm-${p}`, /** @type {string} */ (color));
      });
    });
    terminal.watchBackgroundColor(prefs);
    prefs.readStorage(() => {
      prefs.notifyAll();
      resolveLibdotInitialized();
    });
  });
});
