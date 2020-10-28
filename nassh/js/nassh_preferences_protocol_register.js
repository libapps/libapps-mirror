// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Protocol registration helper dialog.
 */

/**
 * Attempt to register all the protocols we support.
 */
function registerProtocols() {
  nassh.registerProtocolHandler('ssh');
  nassh.registerProtocolHandler('sftp');
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
window.addEventListener('DOMContentLoaded', (event) => {
  document.getElementById('proto-register').onclick = registerProtocols;
  document.getElementById('proto-open-settings').onclick = openSettings;
});
