// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Externs definitions for mocha.
 *
 * @externs
 */

/** @constructor */
function Mocha() {}

/** @constructor */
Mocha.Runner = function() {};

/** @param {Error} err */
Mocha.Runner.prototype.uncaught = function(err) {};

var mocha = {};

mocha.checkLeaks = mocha.run = function() {};

/** @param {string|{globals:!Array<string>}} opts */
mocha.setup = function(opts) {};

/** @param {function(function())} fn */
var after = function(fn) {};

/** @param {function(function())} fn */
var afterEach = function(fn) {};

/** @param {function(function())} fn */
var before = function(fn) {};

/** @param {function(function())} fn */
var beforeEach = function(fn) {};

/**
 * @param {string} name
 * @param {function()} fn
 */
var describe = function(name, fn) {};

/**
 * @param {string} name
 * @param {function(function())} fn
 */
var it = function(name, fn) {};

/**
 * @param {string} name
 * @param {function(function())} fn
 */
it.skip = function(name, fn) {}
