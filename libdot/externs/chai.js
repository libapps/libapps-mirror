// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Externs definitions for chai.
 *
 * @externs
 */

const chai = {};

/**
 * @param {*} expression
 * @param {string=} message
 */
chai.assert = function(expression, message) {};

/**
 * @param {*} actual
 * @param {*} expected
 * @param {string=} message
 */
chai.assert.isAbove = chai.assert.isAtLeast = chai.assert.isAtMost =
chai.assert.isBelow = chai.assert.deepEqual = chai.assert.deepStrictEqual =
chai.assert.equal = chai.assert.include = chai.assert.isAbove =
chai.assert.notEqual = chai.assert.notStrictEqual =
chai.assert.strictEqual = function(actual, expected, message) {};

/**
 * @param {*} actual
 * @param {!RegExp} expected
 * @param {string=} message
 */
chai.assert.match = function(actual, expected, message) {};

/** @param {string=} message */
chai.assert.fail = function(message) {};

/**
 * @param {*} value
 * @param {string=} message
 */
chai.assert.isDefined = chai.assert.isFalse = chai.assert.isFalse =
chai.assert.isNaN = chai.assert.isNull = chai.assert.isTrue =
chai.assert.isUndefined = function(value, message) {};

/**
 * @param {!Object} object
 * @param {!Array<string>} keys
 * @param {string=} message
 */
chai.assert.hasAllKeys = function(object, keys, message) {};

/**
 * @param {!Object} object
 * @param {string} property
 * @param {string=} message
 */
chai.assert.notProperty =
chai.assert.property = function(object, property, message) {};
