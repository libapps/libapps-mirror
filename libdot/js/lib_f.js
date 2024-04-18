// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Grab bag of utility functions.
 */

import {lib} from '../index.js';

/** @const */
lib.f = {};

/**
 * Replace variable references in a string.
 *
 * Variables are of the form %FUNCTION(VARNAME).  FUNCTION is an optional
 * escape function to apply to the value.
 *
 * For example
 *   lib.f.replaceVars("%(greeting), %encodeURIComponent(name)",
 *                     { greeting: "Hello",
 *                       name: "Google+" });
 *
 * Will result in "Hello, Google%2B".
 *
 * @param {string} str String containing variable references.
 * @param {!Object<string, string>} vars Variables to substitute in.
 * @return {string} String with references substituted.
 */
lib.f.replaceVars = function(str, vars) {
  return str.replace(/%([a-z]*)\(([^)]+)\)/gi, function(match, fn, varname) {
      if (typeof vars[varname] == 'undefined') {
        throw new Error(`Unknown variable: ${varname}`);
      }

      let rv = vars[varname];

      if (fn in lib.f.replaceVars.functions) {
        rv = lib.f.replaceVars.functions[fn](rv);
      } else if (fn) {
        throw new Error(`Unknown escape function: ${fn}`);
      }

      return rv;
    });
};

/**
 * Functions that can be used with replaceVars.
 *
 * Clients can add to this list to extend lib.f.replaceVars().
 */
lib.f.replaceVars.functions = {
  encodeURI: encodeURI,
  encodeURIComponent: encodeURIComponent,
  escapeHTML: function(str) {
    const map = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return str.replace(/[<>&"']/g, (m) => map[m]);
  },
};

/**
 * Convert a relative path to a fully qualified URI.
 *
 * @param {string} path Relative path
 * @return {string} Fully qualified URI.
 */
lib.f.getURL = function(path) {
  if (lib.f.getURL.chromeSupported()) {
    return chrome.runtime.getURL(path);
  }

  // Use current location origin if path is absolute.
  if (path.startsWith('/')) {
    return globalThis.location.origin + path;
  }

  return path;
};

/**
 * Determine whether the runtime is Chrome (or equiv).
 *
 * @return {boolean} True if chrome.runtime.getURL is supported.
 */
lib.f.getURL.chromeSupported = function() {
  return !!(globalThis.chrome?.runtime?.getURL);
};

/**
 * Clamp a given integer to a specified range.
 *
 * @param {number} v The value to be clamped.
 * @param {number} min The minimum acceptable value.
 * @param {number} max The maximum acceptable value.
 * @return {number} The clamped value.
 */
lib.f.clamp = function(v, min, max) {
  if (v < min) {
    return min;
  }
  if (v > max) {
    return max;
  }
  return v;
};

/**
 * Left pad a number to a given length with leading zeros.
 *
 * @param {string|number} number The number to pad.
 * @param {number} length The desired length.
 * @return {string} The padded number as a string.
 */
lib.f.zpad = function(number, length) {
  return String(number).padStart(length, '0');
};

/**
 * Find the longest common prefix of a bunch of strings.
 *
 * @param {!Array<string>} elements The strings to check.
 * @param {number=} start Offset to start search.  There is no checking that
 *     earlier portions of the strings match.
 * @return {number} Length of longest common prefix.
 */
lib.f.longestCommonPrefix = function(elements, start = 0) {
  if (elements.length === 0) {
    return start;
  }

  while (true) {
    // Grab the next character to check.
    const c = elements[0][start];

    // If we walked off the end of the string, can't be longer than this.
    if (c === undefined) {
      break;
    }

    // Check all the other strings if they match.
    if (!elements.slice(1).every((ele) => ele[start] === c)) {
      break;
    }

    ++start;
  }

  return start;
};

/**
 * Return the current call stack after skipping a given number of frames.
 *
 * This method is intended to be used for debugging only.  It returns an
 * Object instead of an Array, because the console stringifies arrays by
 * default and that's not what we want.
 *
 * A typical call might look like...
 *
 *    console.log('Something wicked this way came', lib.f.getStack());
 *    //                         Notice the comma ^
 *
 * This would print the message to the js console, followed by an object
 * which can be clicked to reveal the stack.
 *
 * @param {number=} ignoreFrames How many inner stack frames to ignore.  The
 *     innermost 'getStack' call is always ignored.
 * @param {number=} count How many frames to return.
 * @return {!Array<string>} The stack frames.
 */
lib.f.getStack = function(ignoreFrames = 0, count = undefined) {
  const stackArray = (new Error()).stack.split('\n');

  // Always ignore the Error() object and getStack call itself.
  // [0] = 'Error'
  // [1] = '    at Object.lib.f.getStack (file:///.../lib_f.js:267:23)'
  ignoreFrames += 2;

  const max = stackArray.length - ignoreFrames;
  if (count === undefined) {
    count = max;
  } else {
    count = lib.f.clamp(count, 0, max);
  }

  // Remove the leading spaces and "at" from each line:
  // '    at window.onload (file:///.../lib_test.js:11:18)'
  const stackObject = new Array();
  for (let i = ignoreFrames; i < count + ignoreFrames; ++i) {
    stackObject.push(stackArray[i].replace(/^\s*at\s+/, ''));
  }

  return stackObject;
};

/**
 * Divides the two numbers and floors the results, unless the remainder is less
 * than an incredibly small value, in which case it returns the ceiling.
 * This is useful when the number are truncated approximations of longer
 * values, and so doing division with these numbers yields a result incredibly
 * close to a whole number.
 *
 * @param {number} numerator
 * @param {number} denominator
 * @return {number}
 */
lib.f.smartFloorDivide = function(numerator, denominator) {
  const val = numerator / denominator;
  const ceiling = Math.ceil(val);
  if (ceiling - val < .0001) {
    return ceiling;
  } else {
    return Math.floor(val);
  }
};

/**
 * Get a random integer in a range (inclusive).
 *
 * @param {number} min The lowest integer in the range.
 * @param {number} max The highest integer in the range.
 * @return {number} A random number between min & max.
 */
lib.f.randomInt = function(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Get the current OS.
 *
 * @return {!Promise<string>} A promise that resolves to a constant in
 *     runtime.PlatformOs.
 */
lib.f.getOs = function() {
  // Try the brower extensions API.
  if (globalThis.browser?.runtime?.getPlatformInfo) {
    return browser.runtime.getPlatformInfo().then((info) => info.os);
  }

  // Use the native Chrome API if available.
  if (globalThis.chrome?.runtime?.getPlatformInfo) {
    return new Promise((resolve, reject) => {
      return chrome.runtime.getPlatformInfo((info) => resolve(info.os));
    });
  }

  // Fallback logic.  Capture the major OS's.  The rest should support the
  // browser API above.
  if (globalThis.navigator?.userAgent) {
    const ua = navigator.userAgent;
    if (ua.includes('Mac OS X')) {
      return Promise.resolve('mac');
    } else if (ua.includes('CrOS')) {
      return Promise.resolve('cros');
    } else if (ua.includes('Linux')) {
      return Promise.resolve('linux');
    } else if (ua.includes('Android')) {
      return Promise.resolve('android');
    } else if (ua.includes('Windows')) {
      return Promise.resolve('windows');
    }
  }

  // Still here?  No idea.
  return Promise.reject(null);
};

/**
 * Get the current Chrome milestone version.
 *
 * @return {number} The milestone number if we're running on Chrome, else NaN.
 */
lib.f.getChromeMilestone = function() {
  if (globalThis.navigator?.userAgent) {
    const ary = navigator.userAgent.match(/\sChrome\/(\d+)/);
    if (ary) {
      return parseInt(ary[1], 10);
    }
  }

  // Returning NaN will make all number comparisons fail.
  return NaN;
};

/**
 * Return the lastError string in the browser.
 *
 * This object might live in different locations, and it isn't always defined
 * (if there hasn't been a "last error").  Wrap all that ugliness here.
 *
 * @param {?string=} defaultMsg The default message if no error is found.
 * @return {?string} The last error message from the browser.
 */
lib.f.lastError = function(defaultMsg = null) {
  let lastError;
  if (globalThis.browser?.runtime) {
    lastError = browser.runtime.lastError;
  } else if (globalThis.chrome?.runtime) {
    lastError = chrome.runtime.lastError;
  }

  if (lastError && lastError.message) {
    return lastError.message;
  } else {
    return defaultMsg;
  }
};

/**
 * Determine whether the URL is valid.
 *
 * We define "valid" as in "whether the browser will accept it".  We don't
 * check the syntax or probe the remote system at all.  This is important when
 * handling user inputs as passing invalid URLs to Web APIs often trigger
 * exceptions (e.g. URL() or window.location).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/URL
 * @param {string} url The URL to check.
 * @return {boolean} Whether the URL is valid.
 */
lib.f.isValidUrl = function(url) {
  if (url?.startsWith('/')) {
    return true;
  }

  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch (e) {
    return false;
  }
  return true;
};

/**
 * Just like window.open, but enforce noopener.
 *
 * If we're not careful, the website we open will have access to use via its
 * window.opener field.  Newer browser support putting 'noopener' into the
 * features argument, but there are many which still don't.  So hack it.
 *
 * @param {string=} url The URL to point the new window to.
 * @param {string=} name The name of the new window.
 * @param {string=} features The window features to enable.
 * @return {?Window} The newly opened window.
 */
lib.f.openWindow = function(url, name = undefined, features = undefined) {
  // Check the syntax early so we don't have to error check every API below,
  // or create windows that then have to be destroyed.
  if (url !== undefined && !lib.f.isValidUrl(url)) {
    return null;
  }

  // If this context doesn't have an open function, fallback to extension APIs.
  // For example, the background extension service worker.
  if (globalThis.open === undefined) {
    if (name === '_blank') {
      chrome.tabs.create({url});
    } else {
      let type = chrome.windows.CreateType.NORMAL;
      // TODO(vapier): features can encode width & height too.
      if (features !== undefined && features.includes('chrome=no')) {
        type = chrome.windows.CreateType.POPUP;
      }
      chrome.windows.create({
        focused: true,
        type,
        url,
      });
    }
    // We could perhaps return the tab/window from above, the return value is
    // rarely used by callers, so let's be lazy for now.
    return undefined;
  }

  // We create the window first without the URL loaded.
  const win = globalThis.open(undefined, name, features);

  // If the system is blocking window.open, don't crash.
  if (win !== null) {
    // Clear the opener setting before redirecting.
    win.opener = null;

    // Now it's safe to redirect.  Skip this step if the url is not set so we
    // mimic the window.open behavior more precisely.
    if (url) {
      win.location = url;
    }
  }

  return win;
};
