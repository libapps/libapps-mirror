// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Terminal Menu unit tests.
 */

describe('terminal_menu_tests.js', () => {
  it('invokes-callback-when-hash-changes', async function() {
    const mockWindow = new MockWindow();
    async function changeHash(hash) {
      mockWindow.location.hash = hash;
      return mockWindow.events['hashchange'].dispatch({});
    }
    const menu = new terminal.Menu(mockWindow);
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
});
