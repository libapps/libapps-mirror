// Copyright 2013 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Various test helpers meant to be reused by other modules.
 * @suppress {moduleLoad} closure compiler can't handle node_modules/.
 */

import {lib} from '../../libdot/index.js';

import {assert} from '../../node_modules/chai/chai.js';

/**
 * Run the main test page.
 *
 * @param {{
 *   globals: (!Array<string>|undefined),
 *   base: string,
 *   files: !Array<string>,
 * }=} options
 *   globals: Global variables that are exempt from leak checks.
 *   base: The prefix to load files from.
 *   files: Test files to import dynamically.
 */
export function main({globals, base = '', files = []} = {}) {
  // Setup the mocha framework.
  mocha.setup({ui: 'bdd', globals});
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
  globalThis.onerror = function(...args) {
    earlyError = Array.from(args);
  };

  /** Run the test framework once everything is finished. */
  globalThis.onload = async function() {
    // Serially fetch files to guarantee stability in execution order.
    // Performance wise it's basically the same.
    for (const file of files) {
      suiteStart(file);
      await import(`${base}/${file}`);
      suiteEnd();
    }

    mocha.run();
  };

  describe('testRunner', () => {
    /** Make sure no general framework errors happened (e.g. syntax errors). */
    it('uncaught framework errors', () => {
      if (earlyError !== null) {
        assert.fail(`uncaught exception detected:\n${earlyError.join('\n')}`);
      }
    });
  });
}

/**
 * Mocha functions that we need to wrap between suite{Start,End}.
 *
 * See suiteStart for details.
 */
const wrappedFunctions = [
  'after',
  'afterEach',
  'before',
  'beforeEach',
  'describe',
  'it',
  'xit',
];

let currentSuite = null;
const queuedCalls = [];
const backupMocha = [];

/**
 * Capture calls to mocha APIs to delay until suiteEnd.
 *
 * See suiteStart for details.
 *
 * @param {string} fn The function we wrapped.
 * @param {...*} args The arguments to the function.
 */
function captureCall(fn, ...args) {
  queuedCalls.push([fn, args]);
}

/**
 * Group a bunch of tests into a single suite.
 *
 * This is akin to using describe(), but without the nesting.
 *
 * describe('foo', () => {
 *   ...
 * });
 *
 * suiteStart('foo');
 * ...
 * suiteEnd();
 *
 * @param {string} name The name to give to the suite.
 */
function suiteStart(name) {
  // We only support one level of nesting atm.
  assert.isNull(currentSuite);
  currentSuite = name;

  // Wrap all the mocha calls.
  wrappedFunctions.forEach((x) => {
    backupMocha[x] = globalThis[x];
    globalThis[x] = captureCall.bind(null, x);
  });
}

/**
 * End the current suite.
 */
function suiteEnd() {
  // Make sure suiteStart was called.
  assert.isNotNull(currentSuite);

  // Restore the mocha APIs.
  wrappedFunctions.forEach((x) => {
    globalThis[x] = backupMocha[x];
  });
  backupMocha.length = 0;

  // Make all the delayed calls now inside a single describe().
  describe(lib.notNull(currentSuite), function() {
    queuedCalls.forEach(([fn, args]) => {
      globalThis[fn](...args);
    });
  });
  queuedCalls.length = 0;
  currentSuite = null;
}
