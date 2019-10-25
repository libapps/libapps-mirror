// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Terminal Menu unit tests.
 */

describe('terminal_menu_tests.js', () => {
  beforeEach(function() { this.mockWindow = new MockWindow(); });

  it('invokes-callback-when-hash-changes', async function() {
    const changeHash = async hash => {
      this.mockWindow.location.hash = hash;
      return this.mockWindow.events['hashchange'].dispatch({});
    };
    const menu = new terminal.Menu(this.mockWindow);
    let callCount = 0;
    terminal.Menu.HANDLERS.set('#test', () => callCount++);
    await changeHash('#');

    // Callback is triggered, even for the same hash repeatedly.
    menu.install();
    await changeHash('#test');
    assert.equal(callCount, 1);
    await changeHash('#test');
    assert.equal(callCount, 2);
    await changeHash('#notCalled');
    assert.equal(callCount, 2);

    // Not triggered after uninstall.
    menu.uninstall();
    await changeHash('test');
    assert.equal(callCount, 2);
  });

  it('goes-directly-to-settings-on-page-load', async function() {
    this.mockWindow.location = new MockLocation(
        new URL('chrome://terminal/html/terminal.html#options'));
    const menu = new terminal.Menu(this.mockWindow);
    menu.install();
    assert.equal(
        this.mockWindow.location.href,
        'chrome://terminal/html/terminal_settings.html');
  });
});
