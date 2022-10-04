// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

const lib = {};

/**
 * Verify |condition| is truthy else throw Error.
 *
 * This function is primarily for satisfying the JS compiler and should be
 * used only when you are certain that your condition is true.  The function is
 * designed to have a version that throws Errors in tests if condition fails,
 * and a nop version for production code.  It configures itself the first time
 * it runs.
 *
 * @param {boolean} condition A condition to check.
 * @closurePrimitive {asserts.truthy}
 */
lib.assert = function(condition) {
  if (globalThis.chai) {
    lib.assert = globalThis.chai.assert;
  } else {
    lib.assert = function(condition) {};
  }
  lib.assert(condition);
};

/**
 * Verify |value| is not null and return |value| if so, else throw Error.
 * See lib.assert.
 *
 * @template T
 * @param {T} value A value to check for null.
 * @return {T} A non-null |value|.
 * @closurePrimitive {asserts.truthy}
 */
lib.notNull = function(value) {
  lib.assert(value !== null);
  return value;
};

/**
 * Verify |value| is not undefined and return |value| if so, else throw Error.
 * See lib.assert.
 *
 * @template T
 * @param {T} value A value to check for null.
 * @return {T} A non-undefined |value|.
 * @closurePrimitive {asserts.truthy}
 */
lib.notUndefined = function(value) {
  lib.assert(value !== undefined);
  return value;
};
