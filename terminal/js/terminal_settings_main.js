// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Initializes global state used in terminal settings.
 */

import {definePrefs, normalizePrefsInPlace, watchBackgroundColor}
    from './terminal_common.js';

let resolveLibdotInitialized;
window.libdotInitialized = new Promise((resolve) => {
  resolveLibdotInitialized = resolve;
});

window.addEventListener('DOMContentLoaded', (event) => {
  lib.registerInit('terminal-private-storage', (onInit) => {
    hterm.defaultStorage = new lib.Storage.TerminalPrivate(onInit);
  });

  // Load i18n messages.
  lib.registerInit('messages', async (onInit) => {
    // Load hterm.messageManager from /_locales/<lang>/messages.json.
    // Set "useCrlf" to match how the terminal is using it, although we don't
    // actually need it for settings.
    hterm.messageManager.useCrlf = true;
    const url =  lib.f.getURL('/_locales/$1/messages.json');
    await hterm.messageManager.findAndLoadMessages(url);
    document.title = hterm.messageManager.get('TERMINAL_TITLE_SETTINGS');
    onInit();
  });
  lib.init(() => {
    window.PreferenceManager = hterm.PreferenceManager;
    window.preferenceManager = new window.PreferenceManager('default');
    definePrefs(window.preferenceManager);
    watchBackgroundColor(window.preferenceManager, /* updateBody= */ false);
    window.preferenceManager.readStorage(() => {
      normalizePrefsInPlace(window.preferenceManager);
      window.preferenceManager.notifyAll();
      resolveLibdotInitialized();
    });
  });
});
