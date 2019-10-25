// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * CSP means that we can't kick off the initialization from the html file,
 * so we do it like this instead.
 */
window.addEventListener('DOMContentLoaded', (event) => {
  // TODO(crbug.com/999028): Make sure system web apps are not discarded as
  // part of the lifecycle API.  This fix used by crosh and nassh is not
  // guaranteed to be a long term solution.
  chrome.tabs.getCurrent(
      (tab) => { chrome.tabs.update(tab.id, {autoDiscardable: false}); });

  // Load i18n messages.
  lib.registerInit('messages', (onInit) => {
    lib.i18n.getAcceptLanguages(async (languages) => {
      // Replace and load hterm.messageManager.
      hterm.messageManager = new lib.MessageManager(languages, true);
      const url =  lib.f.getURL('/_locales/$1/messages.json');
      await hterm.messageManager.findAndLoadMessages(url);
      onInit();
    });
  });

  lib.init(() => {
    window.term_ = terminal.init();
    new terminal.Menu(window).install();
  });
});
