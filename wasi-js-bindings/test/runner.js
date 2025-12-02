// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview WASI main test runner.
 * @suppress {moduleLoad} closure compiler can't handle node_modules/.
 */

import {assert, config} from '../../node_modules/chai/chai.js';

// Setup the mocha framework.
mocha.setup('bdd');
mocha.checkLeaks();

// Make failure output more useful.
config.includeStack = true;
config.showDiff = true;
config.truncateThreshold = 0;

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
  mocha.run();
};

describe('runner.js', () => {

  /** Make sure no general framework errors happened (e.g. missing include). */
  it('uncaught framework errors', () => {
    if (earlyError !== null) {
      assert.fail(`uncaught exception detected:\n${earlyError.join('\n')}`);
    }
  });

});
