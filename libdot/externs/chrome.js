// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Externs definitions for Chrome APIs not (yet?) in closure.
 * @externs
 */

var chrome = {};

/** @type {!FileSystemProvider} */
chrome.fileSystemProvider;

/** @param {function(!Array<FileSystemProvider>)} callback */
chrome.fileSystemProvider.getAll = function(callback) {};

/** @param {!Object} opts */
chrome.fileSystemProvider.mount = function(opts) {};

/**
 * @param {{fileSystemId: string}} fileSystem
 * @param {function()} callback
 */
chrome.fileSystemProvider.unmount = function(fileSystem, callback) {};

/** @constructor */
function FileSystemProvider() {}

/** @param {!function()} listener */
FileSystemProvider.prototype.addListener = function(listener) {};

/** @type {string} */
FileSystemProvider.prototype.fileSystemId;

/** @type {boolean} */
Metadata.prototype.isDirectory;
