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

chrome.terminalPrivate = {};

/** @param {string} id */
chrome.terminalPrivate.closeTerminalProcess = function(id) {};

/** @param {function(boolean)} callback */
chrome.terminalPrivate.getA11yStatus = function(callback) {};

/** @param {function(!Object<string, *>)} callback */
chrome.terminalPrivate.getCroshSettings = function(callback) {};

/** @param {function(!Object<string, *>)} callback */
chrome.terminalPrivate.getSettings = function(callback) {};

/** @type {ChromeBaseEvent<function(boolean)>} */
chrome.terminalPrivate.onA11yStatusChanged;

/** @type {ChromeBaseEvent<function(string, string, string)>} */
chrome.terminalPrivate.onProcessOutput;

/** @type {ChromeBaseEvent<function(!Object<string, *>)>} */
chrome.terminalPrivate.onSettingsChanged;

/** @param {!Object<string, *>} callback */
chrome.terminalPrivate.setSettings = function(prefValue, callback) {};

/**
 * @param {string} commandName
 * @param {!Array<string>} argv
 * @param {function(string)} callback
 */
chrome.terminalPrivate.openTerminalProcess = function(
    commandName, argv, callback) {};

/**
 * @param {!Array<string>} argv
 * @param {function(string)} callback
 */
chrome.terminalPrivate.openVmshellProcess = function(argv, callback) {};

/**
 * @param {string} id
 * @return {string} input
 */
chrome.terminalPrivate.sendInput = function(id, input) {};

/** @constructor */
function FileSystemProvider() {}

/** @param {!function()} listener */
FileSystemProvider.prototype.addListener = function(listener) {};

/** @type {string} */
FileSystemProvider.prototype.fileSystemId;

/** @type {boolean} */
Metadata.prototype.isDirectory;
