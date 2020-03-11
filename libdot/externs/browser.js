// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Externs definitions for browser APIs.
 * @externs
 */

const browser = {};

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

/**
 * @interface
 * @template LISTENER
 */
function ChromeBaseEvent() {}

/** @param {LISTENER} callback */
ChromeBaseEvent.prototype.addListener = function(callback) {};

/** @param {LISTENER} callback */
ChromeBaseEvent.prototype.removeListener = function(callback) {};

const chrome = {};

/** @const */
chrome.app = {};

/**
 * @constructor
 * @extends {Window}
 */
chrome.app.AppWindow = function() {
  /** @type {{width: number, height: number}} */
  this.innerBounds;
};

/** @return {boolean} */
chrome.app.AppWindow.prototype.isAlwaysOnTop = function() {};

/** @return {boolean} */
chrome.app.AppWindow.prototype.isFullscreen = function() {};

/** @return {boolean} */
chrome.app.AppWindow.prototype.isMaximized = function() {};

/** @return {boolean} */
chrome.app.AppWindow.prototype.isMinimized = function() {};

/** @const */
chrome.app.runtime = {};

/** @type {!ChromeBaseEvent<function()>} */
chrome.app.runtime.onLaunched;

/** @type {!ChromeBaseEvent<function()>} */
chrome.app.runtime.onRestarted;

/** @const */
chrome.app.window = {};

/**
 * @param {string} url
 * @param {{
 *     alwaysOnTop: (boolean|undefined),
 *     focused: (boolean|undefined),
 *     id: (string|undefined),
 *     innerBounds: ({width: number, height: number}|undefined),
 * }=} opts
 * @param {function()=} callback
 */
chrome.app.window.create = function(url, opts, callback) {};

/** @return {!chrome.app.AppWindow} */
chrome.app.window.current = function() {};

/** @const */
chrome.browserAction = {};

/** @const */
chrome.extension = {};

/** @param {string} path */
chrome.extension.getURL = function(path) {};

/** @type {!Array<FileSystemProvider>} */
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

/** @const */
chrome.i18n = {};

/** @constructor */
chrome.Omnibox = function() {};

/** @type {!ChromeBaseEvent<function()>} */
chrome.Omnibox.prototype.onInputCancelled;

/** @type {!ChromeBaseEvent<function(string, function())>} */
chrome.Omnibox.prototype.onInputChanged;

/** @type {!ChromeBaseEvent<function(string, string)>} */
chrome.Omnibox.prototype.onInputEntered;

/** @type {!ChromeBaseEvent<function()>} */
chrome.Omnibox.prototype.onInputStarted;

/** @param {{description: string}} desc */
chrome.Omnibox.prototype.setDefaultSuggestion = function(desc) {};

/** @type {!chrome.Omnibox} */
chrome.omnibox;

/** @const */
chrome.runtime = {};

/**
 * @param {string} id
 */
chrome.runtime.connect = function(id) {};

/** @type {!Event} */
chrome.runtime.connect.onDisconnect;

/**
 * @return {{
 *     name: string,
 *     version: string,
 *     icons: !Object<number, string>,
 * }}
 */
chrome.runtime.getManifest = function() {};

/** @param {function(!Window)} callback */
chrome.runtime.getBackgroundPage = function(callback) {};

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

/**
 * @typedef {{
 *     reason: string,
 *     previousVersion: string,
 *     id: string,
 * }}
 */
chrome.runtime.onInstalled.Details;

/**
 * @type {!ChromeBaseEvent<function(chrome.runtime.onInstalled.Details)>}
 */
chrome.runtime.onInstalled;

/**
 * @type {!ChromeBaseEvent<function(
 *     {command: string},
 *     {id: string},
 *     function(!Object=)): boolean
 * >}
 */
chrome.runtime.onMessageExternal;

/**
 * @param {*} extensionIdOrRequest
 * @param {?*=} request
 * @param {function(*)=} callback
 */
chrome.runtime.sendMessage = function(
    extensionIdOrRequest, request, callback) {};

/** @const */
chrome.storage = {};

/** @type {!StorageArea} */
chrome.storage.local;

/** @type {!StorageArea} */
chrome.storage.managed;

/** @type {!ChromeBaseEvent<function(!Array<*>, string)>} */
chrome.storage.onChanged;

/** @type {!StorageArea} */
chrome.storage.sync;

/** @const */
chrome.tabs = {};

/** @param {{url: (string|undefined), active: (boolean|undefined)}} opts */
chrome.tabs.create = function(opts) {};

/** @param {function({id:string})} callback */
chrome.tabs.getCurrent = function(callback) {};

/**
 * @param {{active: boolean, currentWindow: boolean}} query
 * @param {function({id: string})} callback
 */
chrome.tabs.query = function(query, callback) {};

/** @param {string} id */
chrome.tabs.remove = function(id) {};

/**
 * @param {string} id
 * @param {{autoDiscardable: boolean}} opts
 */
chrome.tabs.update = function(id, opts) {};

/** @const */
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

/** @const */
chrome.windows = {};

/**
 * @param {{
 *     url: string,
 *     width: number,
 *     height: number,
 *     focused: boolean,
 *     type: string,
 * }} opts
 * @param {function()=} callback
 */
chrome.windows.create = function(opts, callback) {};

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
function FileSystemProvider() {}

/** @param {!function()} listener */
FileSystemProvider.prototype.addListener = function(listener) {};

/** @type {string} */
FileSystemProvider.prototype.fileSystemId;

/** @param {string|!ArrayBuffer|!Object} message */
HTMLEmbedElement.prototype.postMessage = function(message) {};

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

/** @type {boolean} */
Metadata.prototype.isDirectory;

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

/**
 * @constructor
 * @extends {Element}
 */
function SVGSVGElement() {}

/** @type {number} */
SVGSVGElement.prototype.currentScale;
