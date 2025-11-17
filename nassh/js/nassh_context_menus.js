// Copyright 2025 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Context menu handling logic in various browser locations, not
 *   in the application (terminal) itself.
 */

import {lib} from '../../libdot/index.js';

import {localize, sendFeedback} from './nassh.js';

/**
 * Handler for custom context menus integration.
 *
 * @see https://developer.chrome.com/docs/extensions/reference/api/contextMenus
 * @see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus
 */
export class ContextMenusHandler {
  constructor({contextMenus} = {}) {
    this.contextMenus_ = contextMenus;
  }

  /**
   * Set up context menus.
   *
   * NB: We omit "Options" because Chrome takes care of populating that entry.
   */
  install() {
    // Remove any previous entries.  This comes up when reloading the page.
    this.contextMenus_.removeAll();

    this.contextMenus_.onClicked.addListener(this.onContextMenu_.bind(this));

    /** @type {!Array<!chrome.contextMenus.CreateProperties>} */
    const entries = [
      {
        'type': 'normal',
        'id': 'connect-dialog',
        'title': localize('CONNECTION_DIALOG_NAME'),
        'contexts': ['action'],
      },
      {
        'type': 'normal',
        'id': 'feedback',
        'title': localize('SEND_FEEDBACK_LABEL'),
        'contexts': ['action'],
      },
    ];
    entries.forEach((entry) => this.contextMenus_.create(entry));
  }

  /**
   * Callback from context menu clicks.
   *
   * @param {!Object} info The item clicked.
   * @param {!Tab=} tab When relevant, the active tab.
   */
  onContextMenu_(info, tab = undefined) {
    switch (info.menuItemId) {
      case 'connect-dialog':
        lib.f.openWindow(lib.f.getURL('/html/nassh_connect_dialog.html'), '',
                         'chrome=no,close=yes,resize=yes,minimizable=yes,' +
                         'scrollbars=yes,width=900,height=600');
        break;
      case 'feedback':
        sendFeedback();
        break;
      default:
        console.error('Unknown menu item', info);
        break;
    }
  }
}
