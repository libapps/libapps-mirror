// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test framework setup when run inside the browser.
 */

import {init} from './terminal_common.js';

/**
 * Listens for the next change to the specified preference.
 *
 * @param {!lib.PreferenceManager} prefMgr
 * @param {string} prefName
 * @return {!Promise<void>} Promise which resolves when preference is changed.
 */
export function listenForPrefChange(prefMgr, prefName) {
  return new Promise((resolve) => {
    const observer = () => {
      resolve();
      prefMgr.removeObserver(prefName, observer);
    };
    prefMgr.addObserver(prefName, observer);
  });
}

// Setup the mocha framework.
// TODO(lxj@google.com): Move preference manager into a module such that it is
// no longer a global variable.
mocha.setup({ui: 'bdd', globals: [
  'PreferenceManager',
  'preferenceManager',
  'storage',
]});
mocha.checkLeaks();

// Catch any random errors before the test runner runs.
let earlyError = null;

/**
 * Catch any errors.
 *
 * @param {*} args Whatever arguments are passed in.
 */
window.onerror = function(...args) {
  earlyError = Array.from(args);
};

/** Run the test framework once everything is finished. */
window.onload = async function() {
  await init();
  mocha.run();
};

describe('terminal_test.js', () => {

  /** Make sure no general framework errors happened (e.g. syntax error). */
  it('uncaught framework errors', () => {
    if (earlyError !== null) {
      assert.fail(`uncaught exception detected:\n${earlyError.join('\n')}`);
    }
  });

});

/**
 * @suppress {constantProperty} Allow tests in all browsers.
 */
window.chrome = window.chrome || {};
