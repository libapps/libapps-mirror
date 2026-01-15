// Copyright 2026 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Chrome MV3 extension updates that closure-compiler is missing.
 * @externs
 */

/**
 * @see https://developer.chrome.com/extensions/storage.html#type-StorageArea
 * @constructor
 */
function StorageArea() {}

/**
 * @param {(string|!Array<string>|!Object|null)=} keys
 * @return {!Promise<!Object>}
 */
StorageArea.prototype.get = function(keys) {};

/**
 * @param {(string|!Array<string>|null)=} keys
 * @return {!Promise<number>}
 */
StorageArea.prototype.getBytesInUse = function(keys) {};

/**
 * @param {!Object<string>} items
 * @return {!Promise<void>}
 */
StorageArea.prototype.set = function(items) {};

/**
 * @param {(string|!Array<string>)} keys
 * @return {!Promise<void>}
 */
StorageArea.prototype.remove = function(keys) {};

/** @return {!Promise<void>} */
StorageArea.prototype.clear = function() {};

/** @type {!StorageAreaChangeEvent} */
StorageArea.prototype.onChanged;
