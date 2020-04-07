// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Initializes global state used in terminal.
 */

import {terminal} from './terminal.js';
import {TerminalDisplayManagerElement as Manager} from
    './terminal_display_manager.js';

window.addEventListener('DOMContentLoaded', () => {
  // TODO(crbug.com/999028): Make sure system web apps are not discarded as
  // part of the lifecycle API.  This fix used by crosh and nassh is not
  // guaranteed to be a long term solution.
  chrome.tabs.getCurrent(
      (tab) => { chrome.tabs.update(tab.id, {autoDiscardable: false}); });

  lib.registerInit('terminal-private-storage', (onInit) => {
    hterm.defaultStorage = new lib.Storage.TerminalPrivate(onInit);
  });

  // Load i18n messages.
  lib.registerInit('messages', async (onInit) => {
    // Load hterm.messageManager from /_locales/<lang>/messages.json.
    hterm.messageManager.useCrlf = true;
    const url = lib.f.getURL('/_locales/$1/messages.json');
    await hterm.messageManager.findAndLoadMessages(url);
    onInit();
  });

  lib.registerInit('migrate-settings', terminal.migrateSettings);

  lib.init(() => {
    document.querySelector(Manager.is)
        .addEventListener('terminal-window-ready', (event) => {
      const element = document.createElement('div');
      element.style.width = element.style.height = '100%';
      element.addEventListener('terminal-closing', () => {
        event.target.destroySlot(event.detail.slot);
      });
      element.setAttribute('slot', event.detail.slot);
      event.target.appendChild(element);
      window.term_ = terminal.init(element);
    });
    customElements.define(Manager.is, Manager);
  });
});
