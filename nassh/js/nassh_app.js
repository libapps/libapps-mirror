// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../../libdot/index.js';

import {localize, sendFeedback} from './nassh.js';

/**
 * The singleton app instance for the nassh packaged app, created by the
 * background page.
 *
 * @constructor
 */
export function App() {}

/**
 * Set up context menus.
 *
 * NB: We omit "Options" because Chrome takes care of populating that entry.
 */
App.prototype.installContextMenus = function() {
  // Remove any previous entries.  This comes up when reloading the page.
  chrome.contextMenus.removeAll();

  chrome.contextMenus.onClicked.addListener(this.onContextMenu_.bind(this));

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
  entries.forEach((entry) => chrome.contextMenus.create(entry));
};

/**
 * Callback from context menu clicks.
 *
 * @param {!Object} info The item clicked.
 * @param {!Tab=} tab When relevant, the active tab.
 */
App.prototype.onContextMenu_ = function(info, tab = undefined) {
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
};
