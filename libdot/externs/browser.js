// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Externs definitions for browser APIs.
 * @externs
 */

const browser = {};

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

const chrome = {};

/** @const */
chrome.i18n = {};

/** @const */
chrome.runtime = {};

/** @param {function({os: string})} callback */
chrome.runtime.getPlatformInfo = function(callback) {};

/**
 * @param {string} path
 * @return {string}
 */
chrome.runtime.getURL = function(path) {};

/**
 * @type {{message: (string|undefined)}}
 * @const
 */
chrome.runtime.lastError = {};

/** @const */
chrome.storage = {};

/** @type {!StorageArea} */
chrome.storage.local;

/** @type {!StorageArea} */
chrome.storage.managed;

/** @type {!StorageChangeEvent} */
chrome.storage.onChanged;

/** @type {!StorageArea} */
chrome.storage.sync;

/** @const */
chrome.tabs = {};

/** @param {function({id:string})} callback */
chrome.tabs.getCurrent = function(callback) {};

/**
 * @param {string} id
 * @param {{autoDiscardable: boolean}} opts
 */
chrome.tabs.update = function(id, opts) {};

/** @const */
chrome.windows = {};

/**
 * @param {number} windowId
 * @param {?Object} options
 * @param {function(!chrome.windows.Window)} callback
 */
chrome.windows.get = function(windowId, options, callback) {};

/**
 * @param {function(!chrome.windows.Window)} callback
 */
chrome.windows.getCurrent = function(callback) {};

/**
 * @param {number} windowId
 * @param {?Object} updateInfo
 * @param {function(!chrome.windows.Window)=} callback
 */
chrome.windows.update = function(windowId, updateInfo, callback) {};

/** @typedef {{id:number, focused:boolean}} */
chrome.windows.Window;

/** @constructor */
function FileSystemEntry() {}

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

/** @typedef {{done: boolean}} */
Intl.Segmenter.Segment;

/** @constructor */
function StorageArea() {}

StorageArea.prototype.clear = function() {};

/**
 * @param {(string|?Array<string>)} keys
 * @param {function(!Object)=} callback
 */
StorageArea.prototype.get = function(keys, callback) {};

/**
 * @param {(string|!Array<string>)} keys
 * @param {function()=} callback
 */
StorageArea.prototype.remove = function(keys, callback) {};

/**
 * @param {!Object<string>} items
 * @param {function()=} callback
 */
StorageArea.prototype.set = function(items, callback) {};

/** @constructor */
function StorageChangeEvent() {}

/** @param {function(!Array<*>, string)} listener */
StorageChangeEvent.prototype.addListener = function(listener) {};

/**
 * @constructor
 * @extends {Element}
 */
function SVGSVGElement() {}

/** @type {number} */
SVGSVGElement.prototype.currentScale;
