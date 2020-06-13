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
  this.fake = new StorageAreaFake();
  this.storage = new lib.Storage.TerminalPrivate(this.fake);
});

lib.Storage.ApiTest();

/**
 * Make sure multiple writes collapse into one.
 */
it('coalesce-writes', function(done) {
  const storage = this.storage;

  let called = 0;
  this.fake.setSettings = (items, callback = () => {}) => {
    ++called;
    callback();
  };
  storage.setItem('1', 2);
  storage.setItem('3', 2);
  storage.setItem('4', 2);

  // Poll to finish asap, but don't give up too soon.
  let retry = 200;
  const check = () => {
    if (called === 1) {
      done();
    } else if (retry-- > 0) {
      setTimeout(check, 1);
    } else {
      assert.fail();
    }
  };
  check();
});

/**
 * Make sure recursive writes are handled.
 */
it('recursive-writes', function(done) {
  const storage = this.storage;

  let recursive_called = false;
  let called = 0;
  this.fake.setSettings = (items, callback = () => {}) => {
    ++called;
    callback();
  };
  storage.setItem('1', 2, () => {
    storage.setItem('3', 2, () => {
      recursive_called = true;
    });
  });
  storage.setItem('2', 2);

  // Poll to finish asap, but don't give up too soon.
  let retry = 200;
  const check = () => {
    if (called === 2 && recursive_called) {
      done();
    } else if (retry-- > 0) {
      setTimeout(check, 1);
    } else {
      this.fail();
    }
  };
  check();
});

});
