// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * An event is a JavaScript function with addListener and removeListener
 * properties.
 *
 * When the endpoint function is called, all of the listeners will be invoked
 * in the order they were attached.
 *
 * The returned function will have the list of callbacks as its 'observers'
 * property.
 *
 * @return {function(...*)} A function that, when called, invokes all callbacks
 *     with whatever arguments it was passed.
 */
lib.Event = function() {
  const ep = function(...args) {
    ep.observers.forEach((callback) => callback.apply(null, args));
  };

  /**
   * Add a callback function.
   *
   * @param {function(...*)} callback The function to call back.
   */
  ep.addListener = function(callback) {
    ep.observers.push(callback);
  };

  /**
   * Remove a callback function.
   *
   * If the function is registered more than once (weird), all will be removed.
   *
   * @param {function(...*)} callback The function to remove.
   */
  ep.removeListener = function(callback) {
    ep.observers = ep.observers.filter((cb) => cb !== callback);
  };

  ep.observers = [];

  return ep;
};
