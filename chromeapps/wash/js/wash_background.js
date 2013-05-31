// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

(function() {
  var didLaunch = false;

  /**
   * Used to watch for launch events that occur before we're ready to handle
   * them.
   */
  var onLaunched = function() { didLaunch = true };
  chrome.app.runtime.onLaunched.addListener(onLaunched);

  /**
   * Perform any required async initialization, then create our app instance.
   *
   * The window.app_ property will contain the new app instance so it can be
   * reached from the background page's JS console.
   */
  lib.init(function wash_background() {
      var manifest = chrome.runtime.getManifest();

      var app = new wash.App(manifest);

      app.onInit.addListener(function() {
          chrome.app.runtime.onLaunched.removeListener(onLaunched);

          app.installHandlers(chrome.app.runtime);

          if (didLaunch)
            app.onLaunched();
        });

      // Exported for console debugging.
      window.app_ = app;
    }, console.log.bind(console));
})();
