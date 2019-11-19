// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Initializes global state used in terminal settings.
 */
let resolvePreferenceManagerLoaded;
window.preferenceManagerLoaded = new Promise(resolve => {
  resolvePreferenceManagerLoaded = resolve;
});

window.addEventListener('DOMContentLoaded', (event) => {
  lib.registerInit('terminal-private-storage', (onInit) => {
    hterm.defaultStorage = new lib.Storage.TerminalPrivate(onInit);
  });

  lib.init(() => {
    window.PreferenceManager = hterm.PreferenceManager;
    window.preferenceManager = new window.PreferenceManager('default');
    window.preferenceManager.readStorage(resolvePreferenceManagerLoaded);
  });
});
