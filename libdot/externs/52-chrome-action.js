/*
 * Copyright 2009 The Closure Compiler Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Chrome Actions API until closure-compiler updates.
 * @externs
 */

/**
 * @const
 * @see https://developer.chrome.com/extensions/browserAction.html
 */
chrome.action = {};


/**
 * @typedef {{
 *   tabId: (number|undefined)
 * }}
 * @see https://developer.chrome.com/extensions/action#type-TabDetails
 */
chrome.action.TabDetails;


/**
 * @typedef {{
 *   isOnToolbar: boolean
 * }}
 * @see https://developer.chrome.com/extensions/action#type-UserSettings
 */
chrome.action.UserSettings;


/**
 * @typedef {{
 *   windowId: (number|undefined)
 * }}
 * @see https://developer.chrome.com/extensions/action#type-OpenPopupOptions
 */
chrome.action.OpenPopupOptions;


/**
 * @param {{
 *   title: string,
 *   tabId: (number|undefined)
 * }} details
 * @param {function(): void=} opt_callback
 * @return {undefined}
 * @see https://developer.chrome.com/extensions/action#method-setTitle
 */
chrome.action.setTitle = function(details, opt_callback) {};


/**
 * @param {!chrome.action.TabDetails} details
 * @param {function(string): void} callback
 * @return {undefined}
 * @see https://developer.chrome.com/extensions/action#method-getTitle
 */
chrome.action.getTitle = function(details, callback) {};


/**
 * @param {!chrome.browserAction.SetIconImageData} details
 * @param {function(): void=} opt_callback
 * @return {undefined}
 * @see https://developer.chrome.com/extensions/action#method-setIcon
 */
chrome.action.setIcon = function(details, opt_callback) {};


/**
 * @param {{
 *   tabId: (number|undefined),
 *   popup: string
 * }} details
 * @param {function(): void=} opt_callback
 * @return {undefined}
 * @see https://developer.chrome.com/extensions/action#method-setPopup
 */
chrome.action.setPopup = function(details, opt_callback) {};


/**
 * @param {!chrome.action.TabDetails} details
 * @param {function(string): void} callback
 * @return {undefined}
 * @see https://developer.chrome.com/extensions/action#method-getPopup
 */
chrome.action.getPopup = function(details, callback) {};


/**
 * @param {{
 *   text: string,
 *   tabId: (number|undefined)
 * }} details
 * @param {function(): void=} opt_callback
 * @return {undefined}
 * @see https://developer.chrome.com/extensions/action#method-setBadgeText
 */
chrome.action.setBadgeText = function(details, opt_callback) {};


/**
 * @param {!chrome.action.TabDetails} details
 * @param {function(string): void} callback
 * @return {undefined}
 * @see https://developer.chrome.com/extensions/action#method-getBadgeText
 */
chrome.action.getBadgeText = function(details, callback) {};


/**
 * @param {{
 *   color: (string|!chrome.browserAction.ColorArray),
 *   tabId: (number|undefined)
 * }} details
 * @param {function(): void=} opt_callback
 * @return {undefined}
 * @see https://developer.chrome.com/extensions/action#method-setBadgeBackgroundColor
 */
chrome.action.setBadgeBackgroundColor = function(details, opt_callback) {};


/**
 * @param {!chrome.action.TabDetails} details
 * @param {function(!chrome.browserAction.ColorArray): void} callback
 * @return {undefined}
 * @see https://developer.chrome.com/extensions/action#method-getBadgeBackgroundColor
 */
chrome.action.getBadgeBackgroundColor = function(details, callback) {};


/**
 * @param {number=} opt_tabId
 * @param {function(): void=} opt_callback
 * @return {undefined}
 * @see https://developer.chrome.com/extensions/action#method-enable
 */
chrome.action.enable = function(opt_tabId, opt_callback) {};


/**
 * @param {number=} opt_tabId
 * @param {function(): void=} opt_callback
 * @return {undefined}
 * @see https://developer.chrome.com/extensions/action#method-disable
 */
chrome.action.disable = function(opt_tabId, opt_callback) {};


/**
 * @param {?number|undefined} tabId
 * @param {function(boolean): void} callback
 * @return {undefined}
 * @see https://developer.chrome.com/extensions/action#method-isEnabled
 */
chrome.action.isEnabled = function(tabId, callback) {};


/**
 * @param {function(!chrome.action.UserSettings): void} callback
 * @return {undefined}
 * @see https://developer.chrome.com/extensions/action#method-getUserSettings
 */
chrome.action.getUserSettings = function(callback) {};


/**
 * @param {?chrome.action.OpenPopupOptions|undefined} options
 * @param {function(): void} callback
 * @return {undefined}
 * @see https://developer.chrome.com/extensions/action#method-openPopup
 */
chrome.action.openPopup = function(options, callback) {};


/**
 * @interface
 * @extends {ChromeBaseEvent<function(!Tab)>}
 */
chrome.action.ActionTabEvent = function() {};


/**
 * @type {!chrome.action.ActionTabEvent}
 * @see https://developer.chrome.com/extensions/action#event-onClicked
 */
chrome.action.onClicked;
