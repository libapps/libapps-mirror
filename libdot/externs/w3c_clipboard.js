// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Fork this here until it's restored in closure-compiler itself.
 * Waiting for cl/308194978 to land & a new release made.
 */

/**
 * @interface
 * @see https://w3c.github.io/clipboard-apis/#async-clipboard-api
 */
function Clipboard() {}

/**
 * @return {!Promise<string>}
 */
Clipboard.prototype.readText = function() {};

/**
 * @param {string} text
 * @return {!Promise<void>}
 */
Clipboard.prototype.writeText = function(text) {};

/** @const {!Clipboard} */
Navigator.prototype.clipboard;
