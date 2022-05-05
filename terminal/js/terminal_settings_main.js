// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Initializes global state used in terminal settings.
 */

import {SUPPORTED_FONT_FAMILIES, definePrefs, loadWebFont,
  normalizePrefsInPlace} from './terminal_common.js';

// We are loading all web fonts at the beginning because some settings UI need
// to know whether a web font is available.
window.webFontPromises = new Map(
    Array.from(SUPPORTED_FONT_FAMILIES)
        .filter(([f, isWebFont]) => isWebFont)
        .map(([f]) => [
          f,
          loadWebFont(document, f, `terminal-settings:font:${f}`),
        ]),
);

window.addEventListener('DOMContentLoaded', (event) => {
  window.SSH_ENABLED = false;

  if (chrome.terminalPrivate) {
    lib.registerInit('ssh-enabled', async () => {
      return new Promise((resolve) => {
        chrome.terminalPrivate.getOSInfo((info) => {
          window.SSH_ENABLED = !!info.ssh;
          resolve();
        });
      });
    });
  }

  // Load i18n messages.
  lib.registerInit('messages', async () => {
    // Load hterm.messageManager from /_locales/<lang>/messages.json.
    // Set "useCrlf" to match how the terminal is using it, although we don't
    // actually need it for settings.
    hterm.messageManager.useCrlf = true;
    const url = lib.f.getURL('/_locales/$1/messages.json');
    await hterm.messageManager.findAndLoadMessages(url);
    document.title = hterm.messageManager.get('TERMINAL_TITLE_SETTINGS');
  });
  lib.init().then(() => {
    window.PreferenceManager = hterm.PreferenceManager;
    const storage = chrome.terminalPrivate
      ? new lib.Storage.TerminalPrivate() : new lib.Storage.Local();
    window.preferenceManager = new window.PreferenceManager(storage);
    definePrefs(window.preferenceManager);
    window.preferenceManager.readStorage(() => {
      normalizePrefsInPlace(window.preferenceManager);
      window.preferenceManager.notifyAll();
      document.body.appendChild(
          document.createElement('terminal-settings-app'));
    });
  });
});
