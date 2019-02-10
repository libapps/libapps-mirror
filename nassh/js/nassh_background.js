// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

(function() {
  let didLaunch = false;
  const onLaunched = () => { didLaunch = true; };

  // Used to watch for launch events that occur before we're ready to handle
  // them.  We'll clean this up below during init.
  if (nassh.v2) {
    chrome.app.runtime.onLaunched.addListener(onLaunched);
  }
  if (nassh.browserAction) {
    nassh.browserAction.onClicked.addListener(onLaunched);
  }

  /**
   * Perform any required async initialization, then create our app instance.
   *
   * The window.app_ property will contain the new app instance so it can be
   * reached from the background page's JS console.
   */
  lib.init(function() {
    const app = new nassh.App();

    // If we're running as a v2 app, finish setup.
    if (nassh.v2) {
      chrome.app.runtime.onLaunched.removeListener(onLaunched);
      app.installHandlers(chrome.app.runtime);
    }

    // If omnibox is enabled, set it up.
    if (window.chrome && chrome.omnibox) {
      app.installOmnibox(chrome.omnibox);
    }

    // If we're running as an extension, finish setup.
    if (nassh.browserAction) {
      nassh.browserAction.onClicked.removeListener(onLaunched);
      app.installBrowserAction();
    }

    // If the user tried to run us while we were initializing, run it now.
    if (didLaunch) {
      app.onLaunched();
    }

    // "Public" window.app will be retrieved by individual windows via
    // chrome.getBackgroundPage().
    window.app = app;

    // A flag for people who need to load us dynamically to know we're ready.
    // See nassh.getBackgroundPage for the user.
    window.loaded = true;
  }, console.log.bind(console));
})();
