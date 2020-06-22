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

/**
 * @constructor
 * @extends {Element}
 */
function SVGSVGElement() {}

/** @type {number} */
SVGSVGElement.prototype.currentScale;

/** @type {!ChromeEvent} */
StorageArea.prototype.onChanged;
