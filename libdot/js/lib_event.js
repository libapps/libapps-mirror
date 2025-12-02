// Copyright 2013 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../index.js';

/**
 * An event is a JavaScript function with addListener and removeListener
 * properties.
 *
 * When the endpoint function is called, all of the listeners will be invoked
 * in the order they were attached.
 *
 * The returned function will have the list of callbacks as its 'observers'
 * property.
 */
lib.Event = class {
  constructor() {
    this.observers = [];
  }

  /**
   * Call all registered listeners.
   *
   * @param {...*} args The arguments to pass to the callbacks.
   */
  emit(...args) {
    this.observers.forEach((callback) => callback.apply(null, args));
  }

  /**
   * Add a callback function.
   *
   * @param {function(...?)} callback The function to call back.
   */
  addListener(callback) {
    this.observers.push(callback);
  }

  /**
   * Remove a callback function.
   *
   * If the function is registered more than once (weird), all will be removed.
   *
   * @param {function(...?)} callback The function to remove.
   */
  removeListener(callback) {
    this.observers = this.observers.filter((cb) => cb !== callback);
  }
};
