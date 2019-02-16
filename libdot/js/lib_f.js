// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Grab bag of utility functions.
 */
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
 */
lib.f.replaceVars = function(str, vars) {
  return str.replace(/%([a-z]*)\(([^\)]+)\)/gi, function(match, fn, varname) {
      if (typeof vars[varname] == 'undefined')
        throw 'Unknown variable: ' + varname;

      var rv = vars[varname];

      if (fn in lib.f.replaceVars.functions) {
        rv = lib.f.replaceVars.functions[fn](rv);
      } else if (fn) {
        throw 'Unknown escape function: ' + fn;
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
    var map = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return str.replace(/[<>&\"\']/g, (m) => map[m]);
  }
};

/**
 * Parse a query string into a hash.
 *
 * This takes a url query string in the form 'name1=value&name2=value' and
 * converts it into an object of the form { name1: 'value', name2: 'value' }.
 * If a given name appears multiple times in the query string, only the
 * last value will appear in the result.  If the name ends with [], it is
 * turned into an array.
 *
 * Names and values are passed through decodeURIComponent before being added
 * to the result object.
 *
 * @param {string} queryString The string to parse.  If it starts with a
 *     leading '?', the '?' will be ignored.
 */
lib.f.parseQuery = function(queryString) {
  if (queryString.startsWith('?'))
    queryString = queryString.substr(1);

  var rv = {};

  var pairs = queryString.split('&');
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].split('=');
    let key = decodeURIComponent(pair[0]);
    let val = decodeURIComponent(pair[1]);

    if (key.endsWith('[]')) {
      // It's an array.
      key = key.slice(0, -2);
      // The key doesn't exist, or wasn't an array before.
      if (!(rv[key] instanceof Array))
        rv[key] = [];
      rv[key].push(val);
    } else {
      // It's a plain string.
      rv[key] = val;
    }
  }

  return rv;
};

lib.f.getURL = function(path) {
  if (lib.f.getURL.chromeSupported())
    return chrome.runtime.getURL(path);

  return path;
};

lib.f.getURL.chromeSupported = function() {
  return window.chrome && chrome.runtime && chrome.runtime.getURL;
};

/**
 * Clamp a given integer to a specified range.
 *
 * @param {integer} v The value to be clamped.
 * @param {integer} min The minimum acceptable value.
 * @param {integer} max The maximum acceptable value.
 */
lib.f.clamp = function(v, min, max) {
  if (v < min)
    return min;
  if (v > max)
    return max;
  return v;
};

/**
 * Left pad a number to a given length with leading zeros.
 *
 * @param {string|integer} number The number to pad.
 * @param {integer} length The desired length.
 * @return {string} The padded number as a string.
 */
lib.f.zpad = function(number, length) {
  return String(number).padStart(length, '0');
};

/**
 * Return a string containing a given number of space characters.
 *
 * This method maintains a static cache of the largest amount of whitespace
 * ever requested.  It shouldn't be used to generate an insanely huge amount of
 * whitespace.
 *
 * @param {integer} length The desired amount of whitespace.
 * @param {string} A string of spaces of the requested length.
 */
lib.f.getWhitespace = function(length) {
  if (length <= 0)
    return '';

  var f = this.getWhitespace;
  if (!f.whitespace)
    f.whitespace = '          ';

  while (length > f.whitespace.length) {
    f.whitespace += f.whitespace;
  }

  return f.whitespace.substr(0, length);
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
 */
lib.f.getStack = function(ignoreFrames = 0, count = undefined) {
  const stackArray = (new Error()).stack.split('\n');

  // Always ignore the Error() object and getStack call itself.
  // [0] = 'Error'
  // [1] = '    at Object.lib.f.getStack (file:///.../lib_f.js:267:23)'
  ignoreFrames += 2;

  const max = stackArray.length - ignoreFrames;
  if (count === undefined)
    count = max;
  else
    count = lib.f.clamp(count, 0, max);

  // Remove the leading spaces and "at" from each line:
  // '    at window.onload (file:///.../lib_test.js:11:18)'
  const stackObject = new Array();
  for (let i = ignoreFrames; i < count + ignoreFrames; ++i)
    stackObject.push(stackArray[i].replace(/^\s*at\s+/, ''));

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
lib.f.smartFloorDivide = function(numerator,  denominator) {
  var val = numerator / denominator;
  var ceiling = Math.ceil(val);
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
 * @return {Promise<string>} A promise that resolves to a constant in
 *     runtime.PlatformOs.
 */
lib.f.getOs = function() {
  // Try the brower extensions API.
  if (window.browser && browser.runtime && browser.runtime.getPlatformInfo)
    return browser.runtime.getPlatformInfo().then((info) => info.os);

  // Use the native Chrome API if available.
  if (window.chrome && chrome.runtime && chrome.runtime.getPlatformInfo) {
    return new Promise((resolve, reject) =>
        chrome.runtime.getPlatformInfo((info) => resolve(info.os)));
  }

  // Fallback logic.  Capture the major OS's.  The rest should support the
  // browser API above.
  if (window.navigator && navigator.userAgent) {
    const ua = navigator.userAgent;
    if (ua.includes('Mac OS X'))
      return Promise.resolve('mac');
    else if (ua.includes('CrOS'))
      return Promise.resolve('cros');
    else if (ua.includes('Linux'))
      return Promise.resolve('linux');
    else if (ua.includes('Android'))
      return Promise.resolve('android');
    else if (ua.includes('Windows'))
      return Promise.resolve('windows');
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
  if (window.navigator && navigator.userAgent) {
    const ary = navigator.userAgent.match(/\sChrome\/(\d+)/);
    if (ary)
      return parseInt(ary[1]);
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
 * @param {string=} defaultMsg The default message if no error is found.
 * @return {string} The last error message from the browser.
 */
lib.f.lastError = function(defaultMsg = null) {
  let lastError;
  if (window.browser && browser.runtime)
    lastError = browser.runtime.lastError;
  else if (window.chrome && chrome.runtime)
    lastError = chrome.runtime.lastError;

  if (lastError && lastError.message)
    return lastError.message;
  else
    return defaultMsg;
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
 * @return {Window} The newly opened window.
 */
lib.f.openWindow = function(url, name=undefined, features=undefined) {
  // We create the window first without the URL loaded.
  const win = window.open(undefined, name, features);

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
