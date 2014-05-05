// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * An event is a JavaScript function with addListener and removeListener
 * properties.
 *
 * When the endpoint function is called, the firstCallback will be invoked,
 * followed by all of the listeners in the order they were attached, then
 * the finalCallback.
 *
 * The returned function will have the list of callbacks, excluding
 * opt_firstCallback and opt_lastCallback, as its 'observers' property.
 *
 * @param {function(...)} opt_firstCallback The optional function to call
 *     before the observers.
 * @param {function(...)} opt_finalCallback The optional function to call
 *     after the observers.
 *
 * @return {function(...)} A function that, when called, invokes all callbacks
 *     with whatever arguments it was passed.
 */
wam.Event = function(opt_firstCallback, opt_finalCallback) {
  var ep = function() {
    var args = Array.prototype.slice.call(arguments);

    var rv;
    if (opt_firstCallback)
      rv = opt_firstCallback.apply(null, args);

    if (rv === false)
      return;

    for (var i = ep.observers.length - 1; i >= 0; i--) {
      var observer = ep.observers[i];
      observer[0].apply(observer[1], args);
    }

    if (opt_finalCallback)
      opt_finalCallback.apply(null, args);
  }

  /**
   * Add a callback function.
   *
   * @param {function(...)} callback The function to call back.
   * @param {Object} opt_obj The optional |this| object to apply the function
   *     to.  Use this rather than bind when you plan on removing the listener
   *     later, so that you don't have to save the bound-function somewhere.
   */
  ep.addListener = function(callback, opt_obj) {
    if (!callback)
      throw new Error('Missing param: callback');

    ep.observers.unshift([callback, opt_obj]);
  };

  /**
   * Remove a callback function.
   */
  ep.removeListener = function(callback, opt_obj) {
    for (var i = 0; i < ep.observers.length; i++) {
      if (ep.observers[i][0] == callback && ep.observers[i][1] == opt_obj) {
        ep.observers.splice(i, 1);
        break;
      }
    }
  };

  ep.observers = [];


  return ep;
};
