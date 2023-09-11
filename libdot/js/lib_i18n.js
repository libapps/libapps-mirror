// Copyright 2018 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Wrappers over the browser i18n helpers.
 *
 * Arguably some of these functions should be l10n, but oh well.
 */

import {lib} from '../index.js';

/** @const */
lib.i18n = {};

/**
 * Convenience shortcut to the browser i18n object.
 */
lib.i18n.browser_ =
    globalThis.browser?.i18n ? browser.i18n :
    globalThis.chrome?.i18n ? chrome.i18n :
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
 * @return {!Promise<!Array<string>>} Promise resolving to the list of locale
 *     names.
 */
lib.i18n.getAcceptLanguages = function() {
  if (lib.i18n.browser_) {
    return new Promise((resolve) => {
      lib.i18n.browser_.getAcceptLanguages((languages) => {
        // Chrome might be in a bad state and not return any languages.  If we
        // pass this up to the caller who isn't expecting undefined, they'll
        // probably crash.  Fallback to the default language that we expect all
        // translations to have.
        if (!languages) {
          // Clear the error to avoid throwing an unchecked error.
          console.error('getAcceptLanguages failed', lib.f.lastError());
          languages = ['en'];
        }

        resolve(languages);
      });
    });
  } else {
    const languages = navigator.languages || [navigator.language];
    return Promise.resolve(languages);
  }
};

/**
 * Get a message by name, optionally replacing arguments too.
 *
 * https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/i18n/getMessage
 *
 * @param {string} msgname The id for this localized string.
 * @param {?Array<string>=} substitutions Any replacements in the string.
 * @param {string=} fallback Translation if the message wasn't found.
 * @return {string} The translated message.
 */
lib.i18n.getMessage = function(msgname, substitutions = [], fallback = '') {
  // First let the native browser APIs handle everything for us.
  if (lib.i18n.browser_) {
    const message = lib.i18n.browser_.getMessage(msgname, substitutions);
    if (message) {
      return message;
    }
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
 * @param {(?Array<string>|string)=} args Array containing the argument values,
 *     or single value.
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

/**
 * This function aims to copy the chrome.i18n mapping from language to which
 * _locales/<locale>/messages.json translation is used.  E.g. en-AU maps to
 * en_GB.
 * https://cs.chromium.org/chromium/src/ui/base/l10n/l10n_util.cc?type=cs&q=CheckAndResolveLocale
 *
 * @param {string} language language from navigator.languages.
 * @return {!Array<string>} priority list of locales for translation.
 */
lib.i18n.resolveLanguage = function(language) {
  const [lang, region] = language.toLowerCase().split(/[-_]/, 2);

  // Map es-RR other than es-ES to es-419 (Chrome's Latin American
  // Spanish locale).
  if (lang == 'es') {
    if ([undefined, 'es'].includes(region)) {
      return ['es'];
    }
    return ['es_419'];
  }

  // Map pt-RR other than pt-BR to pt-PT. Note that "pt" by itself maps to
  // pt-BR (logic below).
  if (lang == 'pt') {
    if ([undefined, 'br'].includes(region)) {
      return ['pt_BR'];
    }
    return ['pt_PT'];
  }

  // Map zh-HK and zh-MO to zh-TW. Otherwise, zh-FOO is mapped to zh-CN.
  if (lang == 'zh') {
    if (['tw', 'hk', 'mo'].includes(region)) {
      return ['zh_TW'];
    }
    return ['zh_CN'];
  }

  // Map Liberian and Filipino English to US English, and everything else to
  // British English.
  if (lang == 'en') {
    if ([undefined, 'us', 'lr', 'ph'].includes(region)) {
      return ['en'];
    }

    // Our GB translation is not complete, so need to add 'en' as a fallback.
    return ['en_GB', 'en'];
  }

  if (region) {
    return [language.replace(/-/g, '_'), lang];
  } else {
    return [lang];
  }
};
