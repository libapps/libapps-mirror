// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview WASI main test runner.
 */

// Setup the mocha framework.
mocha.setup('bdd');
mocha.checkLeaks();

// Make failure output more useful.
chai.config.includeStack = true;
chai.config.showDiff = true;
chai.config.truncateThreshold = 0;

// Add a global shortcut to the assert API.
globalThis['assert'] = chai.assert;

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
