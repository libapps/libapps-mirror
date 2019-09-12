// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Wrappers over the browser i18n helpers.
 *
 * Arguably some of these functions should be l10n, but oh well.
 */
lib.i18n = {};

/**
 * Convenience shortcut to the browser i18n object.
 */
lib.i18n.browser_ =
    window.browser && browser.i18n ? browser.i18n :
    window.chrome && chrome.i18n ? chrome.i18n :
    null;

/**
 * Return whether the browser supports i18n natively.
 *
 * @return {boolean} True if browser.i18n or chrome.i18n exists.
 */
lib.i18n.browserSupported = function() {
  return lib.i18n.browser_ !== null;
};

/**
 * Get the list of accepted UI languages.
 *
 * https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/i18n/getAcceptLanguages
 *
 * @param {function(!Array<string>)} callback Function to invoke with the
 *     results.  The parameter is a list of locale names.
 */
lib.i18n.getAcceptLanguages = function(callback) {
  if (lib.i18n.browser_) {
    lib.i18n.browser_.getAcceptLanguages(callback);
  } else {
    setTimeout(function() {
        callback([navigator.language.replace(/-/g, '_')]);
      }, 0);
  }
};

/**
 * Get a message by name, optionally replacing arguments too.
 *
 * https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/i18n/getMessage
 *
 * @param {string} msgname The id for this localized string.
 * @param {!Array<string>=} substitutions Any replacements in the string.
 * @param {string=} fallback Translation if the message wasn't found.
 * @return {string} The translated message.
 */
lib.i18n.getMessage = function(msgname, substitutions = [], fallback = '') {
  // First let the native browser APIs handle everything for us.
  if (lib.i18n.browser_) {
    const message = lib.i18n.browser_.getMessage(msgname, substitutions);
    if (message)
      return message;
  }

  // Do our best to get something reasonable.
  return lib.i18n.replaceReferences(fallback, substitutions);
};

/**
 * Replace $1...$n references with the elements of the args array.
 *
 * This largely behaves like Chrome's getMessage helper.  The $# references are
 * always replaced/removed regardless of the specified substitutions.
 *
 * @param {string} msg String containing the message and argument references.
 * @param {!Array<string>=} args Array containing the argument values.
 * @return {string} The message with replacements expanded.
 */
lib.i18n.replaceReferences = function(msg, args = []) {
  // The Chrome API allows a single substitution as a string rather than array.
  if (args === null) {
    args = [];
  }
  if (!(args instanceof Array)) {
    args = [args];
  }

  return msg.replace(/\$(\d+)/g, (m, index) => {
    return index <= args.length ? args[index - 1] : '';
  });
};
