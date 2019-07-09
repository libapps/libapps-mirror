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
chai.assert.isAbove =
chai.assert.isAtLeast =
chai.assert.isAtMost =
chai.assert.isBelow =
chai.assert.deepEqual =
chai.assert.deepStrictEqual =
chai.assert.equal =
chai.assert.include =
chai.assert.isAbove =
chai.assert.lengthOf =
chai.assert.notEqual =
chai.assert.notStrictEqual =
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
chai.assert.isDefined =
chai.assert.isEmpty =
chai.assert.isFalse =
chai.assert.isNaN =
chai.assert.isNotEmpty =
chai.assert.isNotFalse =
chai.assert.isNotNan =
chai.assert.isNotNull =
chai.assert.isNotTrue =
chai.assert.isNull =
chai.assert.isTrue =
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

/**
 * @param {Function} fn
 */
chai.assert.throws = function(fn) {};

/**
 * @param {number} actual
 * @param {number} expected
 * @param {number} delta
 * @param {string=} message
 */
chai.assert.closeTo = function(actual, expected, delta, message) {};
