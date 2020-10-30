// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

(function() {
  let didLaunch = false;
  const onLaunched = () => { didLaunch = true; };

  // We have to turn on listeners here so we can handle messages when first
  // launched (but before lib.registerInit finishes).
  nassh.External.addListeners();

  // Used to watch for launch events that occur before we're ready to handle
  // them.  We'll clean this up below during init.
  if (nassh.browserAction) {
    nassh.browserAction.onClicked.addListener(onLaunched);
  }

  /**
   * Perform any required async initialization, then create our app instance.
   *
   * The window.app_ property will contain the new app instance so it can be
   * reached from the background page's JS console.
   */
  lib.init(console.log.bind(console)).then(() => {
    const app = new nassh.App();

    // If omnibox is enabled, set it up.
    if (window.chrome && chrome.omnibox) {
      app.installOmnibox(chrome.omnibox);
    }

    // Bind the FSP APIs.
    app.installFsp();

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
  });
})();

/**
 * Sync prefs between versions automatically.
 *
 * This helps when installing the dev version the first time, or migrating from
 * the Chrome App variant to the standard extension.
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log(`onInstalled fired due to "${details.reason}"`);
  // Only sync prefs when installed the first time.
  if (details.reason != 'install') {
    return;
  }

  // We'll get called when logging into a new device for the first time when we
  // get installed automatically as part of the overall sync.  We'll have prefs
  // in that case already, so no need to sync.
  const commonPref = '/nassh/profile-ids';
  chrome.storage.sync.get([commonPref], (items) => {
    // Prefs exist, so exit early.
    if (commonPref in items) {
      return;
    }

    const appStableId = 'pnhechapfaindjhompbnflcldabbghjo';
    const appDevId = 'okddffdblfhhnmhodogpojmfkjmhinfp';
    const extStableId = 'iodihamcpbpeioajjeobimgagajmlibd';
    const extDevId = 'algkcnfjnajfhgimadimbjhmpaeohhln';

    /**
     * Try to import prefs from another install into our own.
     *
     * @param {string} srcId The extension to import from.
     * @param {function()=} onError Callback if extension doesn't exist.
     */
    const migrate = (srcId, onError = () => {}) => {
      console.log(`Trying to sync prefs from ${srcId}`);
      nassh.runtimeSendMessage(srcId, {command: 'prefsExport'})
        .then((response) => {
          const {prefs} = response;
          nassh.importPreferences(prefs);
        })
        .catch(onError);
    };

    switch (chrome.runtime.id) {
      case appDevId:
      case extStableId:
        // Sync from stable app.
        migrate(appStableId);
        break;

      case extDevId:
        // Sync from stable ext then stable app then dev app.
        migrate(extStableId, () => {
          migrate(appStableId, () => {
            migrate(appDevId);
          });
        });
        break;
    }
  });
});
