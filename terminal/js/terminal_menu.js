// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Terminal menu watches changes in the URL fragment to detect when a user
 * selects items from the menu.
 *
 * @constructor
 */
terminal.Menu = function() {};

/**
 * @type {!Object<string, function()>}
 * @const
 */
terminal.Menu.HANDLERS = {};

/**
 * Handle hash changes.
 *
 * @param {!HashChangeEvent} event The event to handle.
 */
terminal.Menu.onHashChange = function(event) {
  const handler = terminal.Menu.HANDLERS[window.location.hash];
  if (handler) {
    handler();
  }
  // Reset hash back to empty so that repeated menu selection of the same item
  // will trigger.
  window.location.hash = '';
};
