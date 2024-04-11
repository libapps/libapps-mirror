// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// NB: This file is not loaded as a module because it modifies global scope.
'use strict';

/**
 * @fileoverview Test framework setup when run inside the browser.
 */

// Setup the mocha framework.
mocha.setup('bdd');
mocha.checkLeaks();

// Add a global shortcut to the assert API.
const assert = chai.assert;

// Catch any random errors before the test runner runs.
let earlyError = null;

/**
 * Catch any errors.
 *
 * @param {*} args Whatever arguments are passed in.
 */
globalThis.onerror = function(...args) {
  earlyError = Array.from(args);
};

/** Run the test framework once everything is finished. */
globalThis.onload = function() {
  mocha.run();
};

describe('hterm_test.js', () => {

  /** Make sure no general framework errors happened (e.g. syntax errors). */
  it('uncaught framework errors', () => {
    if (earlyError !== null) {
      assert.fail(`uncaught exception detected:\n${earlyError.join('\n')}`);
    }
  });

});
