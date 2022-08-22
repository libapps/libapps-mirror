// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Initializes global state used in terminal settings.
 */

import {migrateFilesystemFromDomToIndexeddb} from './nassh_fs.js';

import {definePrefs, normalizePrefsInPlace, registerOSInfoPreFetch}
    from './terminal_common.js';

window.addEventListener('DOMContentLoaded', (event) => {
  registerOSInfoPreFetch();

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
  lib.init().then(async () => {
    // Migrate over the DOM filesystem to the new indexeddb-fs.
    // TODO(vapier): Delete this with R110+.
    await migrateFilesystemFromDomToIndexeddb();

    window.PreferenceManager = hterm.PreferenceManager;
    window.storage = chrome.terminalPrivate
      ? new lib.Storage.TerminalPrivate() : new lib.Storage.Local();
    window.preferenceManager = new window.PreferenceManager(
        window.storage, hterm.Terminal.DEFAULT_PROFILE_ID);
    definePrefs(window.preferenceManager);
    window.preferenceManager.readStorage(() => {
      normalizePrefsInPlace(window.preferenceManager);
      window.preferenceManager.notifyAll();
      document.body.appendChild(
          document.createElement('terminal-settings-app'));
    });
  });
});
