// Copyright 2025 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Browser action handling logic.
 */

import {lib} from '../../libdot/index.js';

/**
 * Handler for custom browser action integration.
 *
 * @see https://developer.chrome.com/docs/extensions/reference/api/action
 * @see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/browserAction
 */
export class BrowserActionHandler {
  /**
   * @param {{
   *   browserAction: (
   *     !typeof chrome.action|
   *     !typeof chrome.browserAction|
   *     !typeof browser.browserAction
   *   ),
   * }=} settings The browserAction instance to bind to.
   */
  constructor({browserAction} = {}) {
    this.browserAction_ = browserAction;

    this.earlyData_ = null;
    this.earlyListener_ = null;
    this.initialized_ = false;
  }

  /**
   * Bind callbacks early on synchronously.
   *
   * We have to listen for clicked event so we don't miss it.  We'll clean this
   * up later on during the full install.
   */
  earlyInstall() {
    this.earlyListener_ = this.earlyOnClicked_.bind(this);
    this.browserAction_.onClicked.addListener(this.earlyListener_);
  }

  /**
   * Remember clicks before we were ready.
   */
  earlyOnClicked_() {
    this.earlyData_ = true;
  }

  /**
   * Bind our callbacks and initialize all state.
   */
  install() {
    if (this.initialized_) {
      return;
    }

    this.browserAction_.onClicked.addListener(this.onClicked_.bind(this));

    // If the user triggered while we were sleeping, run it now.
    if (this.earlyListener_ !== null) {
      this.browserAction_.onClicked.removeListener(this.earlyListener_);
      this.earlyListener_ = null;
    }
    if (this.earlyData_ !== null) {
      this.onClicked_();
      this.earlyData_ = null;
    }

    this.initialized_ = true;
  }

  /**
   * Callback when user clicks our icon.
   */
  onClicked_() {
    const width = 900;
    const height = 600;
    lib.f.openWindow(lib.f.getURL('/html/nassh_connect_dialog.html'), '',
                     'chrome=no,close=yes,resize=yes,scrollbars=yes,' +
                     `minimizable=yes,width=${width},height=${height}`);
  }
}
