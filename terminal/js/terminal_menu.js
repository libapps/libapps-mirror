// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Terminal menu watches changes in the URL fragment to detect when a user
 * selects items from the menu.
 *
 * @param {!Window} window Window to attach to for 'hashchange' events.
 * @constructor
 */
terminal.Menu = function(window) {
  this.window = window;
};

/**
 * @type {!Map<string, function(boolean)>}
 * @const
 */
terminal.Menu.HANDLERS = new Map();

/**
 * Install Menu to listen to 'hashchange' events.
 */
terminal.Menu.prototype.install = function() {
  this.listener_ =
      /** @type {!EventListener} */ (this.onHashChange_.bind(this, false));
  this.window.addEventListener('hashchange', this.listener_);
  this.onHashChange_(true);
};

/**
 * Uninstall Menu from listening to 'hashchange' events.
 */
terminal.Menu.prototype.uninstall = function() {
  this.window.removeEventListener('hashchange', this.listener_);
};

/**
 * Handle hash changes.
 *
 * @param {boolean} initialLoad True if this is the initial page load rather
 *     than a change.
 * @param {!HashChangeEvent=} event The event to handle.
 * @private
 */
terminal.Menu.prototype.onHashChange_ = function(initialLoad, event) {
  const handler = terminal.Menu.HANDLERS.get(this.window.location.hash);
  if (handler) {
    handler.call(this, initialLoad);
  }
  // Reset hash back to empty so that repeated menu selection of the same item
  // will trigger.
  this.window.location.hash = '';
};

/** Open settings page in a new window. */
terminal.Menu.HANDLERS.set('#options', function(initialLoad) {
  const url = 'chrome://terminal/html/terminal_settings.html';
  if (initialLoad) {
    this.window.location.replace(url);
  } else {
    chrome.tabs.create({url});
  }
});
