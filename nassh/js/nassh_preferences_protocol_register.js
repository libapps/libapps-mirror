// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Protocol registration helper dialog.
 */

/**
 * Container for all the dialog settings.
 */
nassh.ProtocolRegisterDialog = {};

/**
 * Attempt to register all the protocols we support.
 */
nassh.ProtocolRegisterDialog.register = function() {
  nassh.registerProtocolHandler('ssh');
  nassh.registerProtocolHandler('sftp');
};

/**
 * Open the browser handlers settings page.
 */
nassh.ProtocolRegisterDialog.openSettings = function() {
  // NB: We have to use chrome.tabs.create rather than window.open as Chrome
  // blocks chrome:// URIs with the latter API.
  chrome.tabs.create({url: 'chrome://settings/handlers'});
};

/**
 * Event when the window finishes loading.
 */
window.addEventListener('DOMContentLoaded', (event) => {
  document.getElementById('proto-register').onclick =
      nassh.ProtocolRegisterDialog.register;
  document.getElementById('proto-open-settings').onclick =
      nassh.ProtocolRegisterDialog.openSettings;
});
