// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Initializes global state used in terminal settings.
 */
let resolveLibdotInitialized;
window.libdotInitialized = new Promise(resolve => {
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

    // Add a listener to 'background-color' pref and set
    // <meta id='meta-theme-color' name='theme-color' content="#...">
    // to update tab and frame colors.
    window.preferenceManager.addObserver('background-color', (color) => {
      document.getElementById('meta-theme-color')
          .setAttribute('content', /** @type {string} */(color));
    });
    window.preferenceManager.readStorage(() => {
      window.preferenceManager.notifyAll();
      resolveLibdotInitialized();
    });
  });
});
