// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Terminal Menu unit tests.
 */

describe('terminal_menu_tests.js', () => {
  const changeHash = async function(hash) {
    if (hash == window.location.hash) {
      return;
    }
    return new Promise(resolve => {
      const listener = () => {
        window.removeEventListener('hashchange', listener);
        resolve();
      };
      window.addEventListener('hashchange', listener);
      window.location.hash = hash;
    });
  };

  it('invokes-callback-when-hash-changes', async function() {
    let callCount = 0;
    terminal.Menu.HANDLERS['#test'] = function() { callCount++; };
    await changeHash('');

    // Callback is triggered, even for the same hash repeatedly.
    window.addEventListener('hashchange', terminal.Menu.onHashChange);
    await changeHash('test');
    assert.equal(callCount, 1);
    await changeHash('test');
    assert.equal(callCount, 2);
    await changeHash('notCalled');
    assert.equal(callCount, 2);

    // Not triggered after uninstall.
    window.removeEventListener('hashchange', terminal.Menu.onHashChange);
    await changeHash('test');
    assert.equal(callCount, 2);
  });
});
