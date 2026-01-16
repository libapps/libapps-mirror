// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview The background page that loads & runs everything.  Try to keep
 * code in here minimal as this cannot be unittested.
 */

import {hterm} from '../../hterm/index.js';

import {getSyncStorage, runtimeSendMessage} from './nassh.js';
import {importPreferences} from './nassh_background.js';
import {ContextMenusHandler} from './nassh_context_menus.js';
import {ExternalApi} from './nassh_external_api.js';
import {probeExtensions} from './nassh_google.js';
import {OmniboxHandler} from './nassh_omnibox.js';
import {SftpFsp} from './nassh_sftp_fsp.js';

let omniboxHandler = null;
if (globalThis.chrome?.omnibox) {
  omniboxHandler = new OmniboxHandler({
    omnibox: chrome.omnibox,
    storage: getSyncStorage(),
  });

  // Set up basic listeners so we don't miss events before we're ready.
  omniboxHandler.earlyInstall();
}

// We have to turn on listeners here so we can handle messages when first
// launched.
const externalApi_ = new ExternalApi();
externalApi_.addListeners();

/**
 * Perform any required async initialization, then create our app instance.
 *
 * The window.app_ property will contain the new app instance so it can be
 * reached from the background page's JS console.
 */
function init() {
  const fsp = new SftpFsp();
  externalApi_.init(fsp);

  // Register our context menus.
  const contextMenusHandler = new ContextMenusHandler({
    contextMenus: chrome.contextMenus,
  });
  contextMenusHandler.install();

  // If omnibox is enabled, set it up.
  if (omniboxHandler) {
    omniboxHandler.install();
  }

  // Probe Google extensions.
  probeExtensions();

  // Bind the FSP APIs.
  fsp.addListeners();
}

/**
 * Sync prefs between versions automatically.
 *
 * This helps when installing the dev version the first time.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`onInstalled fired due to "${details.reason}"`);

  // Only sync prefs when installed the first time.
  if (details.reason != 'install') {
    return;
  }

  const storage = getSyncStorage();

  // We'll get called when logging into a new device for the first time when we
  // get installed automatically as part of the overall sync.  We'll have prefs
  // in that case already, so no need to sync.
  if (await storage.getItem('/nassh/profile-ids') !== undefined) {
    // Prefs exist, so exit early.
    return;
  }

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
    runtimeSendMessage(srcId, {command: 'prefsExport'})
      .then((response) => {
        const {prefs} = response;
        return importPreferences(prefs);
      })
      .catch(onError);
  };

  switch (chrome.runtime.id) {
    case extDevId:
      // Sync from stable ext.
      migrate(extStableId);
      break;
  }
});

// Initialize the page!
hterm.initPromise.then(init);
