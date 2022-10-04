// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Protocol registration helper dialog.
 */

import {registerProtocolHandler} from './nassh.js';

/**
 * Attempt to register all the protocols we support.
 */
function registerProtocols() {
  registerProtocolHandler('ssh');
  registerProtocolHandler('sftp');
}

/**
 * Open the browser handlers settings page.
 */
function openSettings() {
  // NB: We have to use chrome.tabs.create rather than window.open as Chrome
  // blocks chrome:// URIs with the latter API.
  chrome.tabs.create({url: 'chrome://settings/handlers'});
}

/**
 * Event when the window finishes loading.
 */
globalThis.addEventListener('DOMContentLoaded', (event) => {
  document.getElementById('proto-register').onclick = registerProtocols;
  document.getElementById('proto-open-settings').onclick = openSettings;
});
