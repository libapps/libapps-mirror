// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test framework setup when run inside the browser.
 * @suppress {moduleLoad} closure compiler can't handle node_modules/.
 */

import {assert} from '../../node_modules/chai/chai.js';

import {init} from './terminal_common.js';

// Setup the mocha framework.
// TODO(lxj@google.com): Move preference manager into a module such that it is
// no longer a global variable.
mocha.setup({ui: 'bdd', globals: [
  'PreferenceManager',
  'preferenceManager',
  'storage',
]});
mocha.checkLeaks();

// Add a global shortcut to the assert API.
globalThis['assert'] = assert;

// Catch any random errors before the test runner runs.
let earlyError = null;

/**
 * Catch any errors.
 *
 * @param {...*} args Whatever arguments are passed in.
 */
window.onerror = function(...args) {
  earlyError = Array.from(args);
};

/** Run the test framework once everything is finished. */
window.onload = async function() {
  await init();
  mocha.run();
};

describe('terminal_test_main.js', () => {

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
