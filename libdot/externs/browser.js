// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Externs definitions for browser APIs.
 * @externs
 */

var browser = {};

/** @const */
browser.browserAction = {};

/** @const */
browser.i18n = {};

/** @param {function(!Array<string>)} callback */
browser.i18n.getAcceptLanguages = function(callback) {};

/**
 * @param {string} messageName
 * @param {(string|?Array<string>)=} substitutions
 * @return {string}
 */
browser.i18n.getMessage = function(messageName, substitutions) {};

/** @const */
browser.runtime = {};

/** @type {{message:(string|undefined)}|undefined} */
browser.runtime.lastError;

/**
 * @typedef {{
 *   os: string,
 *   arch: string,
 * }}
 */
browser.runtime.PlatformInfo;

/**
 * @return {!Promise<!browser.runtime.PlatformInfo>}
 */
browser.runtime.getPlatformInfo = function() {};

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

/**
 * Pending in cl/309118680.
 *
 * @type {!Object<string, string>}
 */
chrome.runtime.Manifest.prototype.icons;

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

var Intl = Intl || {};

/**
 * @param {string=} locales
 * @param {!{localeMatcher:(string|undefined), granularity:(string|undefined)}=}
 *     options
 * @constructor
 */
Intl.Segmenter = function(locales, options) {};

/** @constructor */
Intl.Segmenter.Iterator = function() {};

/** @return {!Intl.Segmenter.Segment} */
Intl.Segmenter.Iterator.prototype.next = function() {};

/**
 * @param {string} s
 * @return {!Intl.Segmenter.Iterator}
 */
Intl.Segmenter.prototype.segment = function(s) {};

/**
 * @typedef {{
 *   done: boolean,
 *   value: ?{segment: string, breakType: string},
 * }}
 */
Intl.Segmenter.Segment;

/** @type {boolean} */
Metadata.prototype.isDirectory;

/**
 * @constructor
 * @extends {Element}
 */
function SVGSVGElement() {}

/** @type {number} */
SVGSVGElement.prototype.currentScale;
