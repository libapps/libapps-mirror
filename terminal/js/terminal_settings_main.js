// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Initializes global state used in terminal settings.
 */

import {lib} from '../../libdot/index.js';
import {hterm} from '../../hterm/index.js';

import {definePrefs, init, normalizePrefsInPlace} from './terminal_common.js';

window.addEventListener('DOMContentLoaded', async () => {
  await init();
  document.title = hterm.messageManager.get('TERMINAL_TITLE_SETTINGS');

  window.PreferenceManager = hterm.PreferenceManager;
  window.storage = chrome.terminalPrivate
      ? new lib.Storage.TerminalPrivate() : new lib.Storage.Local();
  window.preferenceManager = new window.PreferenceManager(
      window.storage, hterm.Terminal.DEFAULT_PROFILE_ID);
  definePrefs(window.preferenceManager);
  window.preferenceManager.readStorage().then(() => {
    normalizePrefsInPlace(window.preferenceManager);
    window.preferenceManager.notifyAll();
    document.body.appendChild(
        document.createElement('terminal-settings-app'));
  });
});
