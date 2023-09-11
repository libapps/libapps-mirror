// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test suite for Terminal private storage.
 */

import {lib} from '../index.js';
import {storageApiTest} from './lib_storage_tests.js';

describe('lib_storage_terminal_private_tests.js', () => {

/**
 * Fake for Chrome storage APIs.
 */
class StorageAreaFake {
  constructor() {
    /** @private {!Object<string, *>} */
    this.storage_ = {'test.path': {}};

    /** @const @private {!Array<function(!Object)>} */
    this.listeners_ = [];

    /**
     * @type {!ChromeEvent}
     * @suppress {checkTypes} The mock is not an exact match.
     */
    this.onPrefChanged = {
      addListener: (listener) => this.listeners_.push(listener),
    };
  }

  /**
   * @param {!Array<string>} paths
   * @param {function(!Object<string,*>)} callback
   */
  getPrefs(paths, callback) {
    assert.equal(arguments.length, 2);
    assert.isArray(paths);
    assert.equal(1, paths.length);
    assert.equal('test.path', paths[0]);
    assert.equal('function', typeof callback);

    setTimeout(() => callback(Object.assign({}, this.storage_)));
  }

  /**
   * @param {!Object<string, *>} prefs
   * @param {function()=} callback
   */
  setPrefs(prefs, callback = () => {}) {
    assert.equal(arguments.length, 2);
    assert.equal('object', typeof prefs);
    assert.equal('function', typeof callback);

    this.storage_ = Object.assign({}, prefs);
    this.listeners_.forEach((listener) => listener(this.storage_));
    setTimeout(callback);
  }
}

/**
 * Initialize the storage fakes & APIs.
 */
beforeEach(function() {
  this.fake = new StorageAreaFake();
  this.storage = new lib.Storage.TerminalPrivate('test.path', this.fake);
});

storageApiTest();

/**
 * Make sure multiple writes collapse into one.
 */
it('coalesce-writes', function(done) {
  const storage = this.storage;

  let called = 0;
  this.fake.setPrefs = (prefs, callback = () => {}) => {
    ++called;
    callback();
  };
  Promise.all([
    storage.setItem('1', 2),
    storage.setItem('3', 2),
    storage.setItem('4', 2),
  ]).then(() => {
    assert.equal(called, 1);
    done();
  });
});

/**
 * Make sure recursive writes are handled.
 */
it('recursive-writes', function(done) {
  const storage = this.storage;

  let recursive_called = false;
  let called = 0;
  this.fake.setPrefs = (prefs, callback = () => {}) => {
    ++called;
    callback();
  };
  storage.setItem('1', 2).then(() => {
    storage.setItem('3', 2).then(() => {
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
