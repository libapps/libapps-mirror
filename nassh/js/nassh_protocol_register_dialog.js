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
 * Translate the dialog.
 */
nassh.ProtocolRegisterDialog.updateLabels = function() {
  lib.i18n.getAcceptLanguages((languages) => {
    const mm = new lib.MessageManager(languages);
    mm.processI18nAttributes(document);
  });
};

/**
 * Event when the window finishes loading.
 */
window.addEventListener('DOMContentLoaded', (event) => {
  lib.init(() => {
    nassh.ProtocolRegisterDialog.updateLabels();
    window.document.getElementById('register').onclick =
        nassh.ProtocolRegisterDialog.register;
    window.document.getElementById('settings').onclick =
        nassh.ProtocolRegisterDialog.openSettings;
  });
});
