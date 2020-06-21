// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Test suite for Terminal private storage.
 */

describe('lib_storage_terminal_private_tests.js', () => {

/**
 * Fake for Chrome storage APIs.
 */
class StorageAreaFake {
  constructor() {
    this.storage_ = {};

    /**
     * @type {!ChromeEvent}
     * @suppress {checkTypes} The mock is not an exact match.
     */
    this.onSettingsChanged = {
      addListener: () => {},
    };
  }

  /**
   * @param {function(!Object<string,*>)} callback
   */
  getSettings(callback) {
    assert.equal(arguments.length, 1);
    assert.equal('function', typeof callback);

    setTimeout(() => callback(Object.assign({}, this.storage_)));
  }

  /**
   * @param {!Object<string, *>} items
   * @param {function()=} callback
   */
  setSettings(items, callback = () => {}) {
    assert.equal(arguments.length, 2);
    assert.equal('object', typeof items);
    assert.equal('function', typeof callback);

    this.storage_ = Object.assign({}, items);
    setTimeout(callback);
  }
}

/**
 * Initialize the storage fakes & APIs.
 */
beforeEach(function() {
  const fake = new StorageAreaFake();
  this.storage = new lib.Storage.TerminalPrivate(fake);
});

lib.Storage.ApiTest();

});
