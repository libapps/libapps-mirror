// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

(function() {
  /**
   * Perform any required async initialization, then create our app instance.
   *
   * The window.app_ property will contain the new app instance so it can be
   * reached from the background page's JS console.
   */
  lib.init(function nassh_background() {
      var manifest = chrome.runtime.getManifest();

      var app = new nassh.App(manifest);

      app.onInit.addListener(function() {
          console.log('background-page: init complete');
        });

      // "Public" window.app will be retrieved by individual windows via
      // chrome.getBackgroundPage().
      window.app = app;
    }, console.log.bind(console));
})();
