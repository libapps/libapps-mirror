// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Common storage API tests.
 */

/**
 * Testsuite for the generic storage API.
 *
 * Each implementation should call this to verify functionality.
 */
lib.Storage.ApiTest = function() {

/**
 * Verify single get/set APIs.
 */
it('get-set', function(done) {
  const storage = this.storage;

  // Make sure we can set an item and read it back out.
  storage.getItem('foo', (value) => {
    assert.isUndefined(value);

    storage.setItem('foo', 1, () => {
      storage.getItem('foo', (value) => {
        assert.equal(value, 1);

        done();
      });
    });
  });
});

/**
 * Verify multiple get/set APIs.
 */
it('gets-sets', function(done) {
  const storage = this.storage;

  storage.getItems(null, (value) => {
    assert.deepEqual(value, {});

    storage.getItems(['foo'], (value) => {
      assert.deepEqual(value, {});

      storage.setItems({'foo': 1, 'bar': 2, 'cow': 3}, () => {
        storage.getItems(['foo'], (value) => {
          assert.deepEqual(value, {'foo': 1});

          storage.getItems(['foo', 'bar'], (value) => {
            assert.deepEqual(value, {'foo': 1, 'bar': 2});

            storage.getItems(null, (value) => {
              assert.deepEqual(value, {'foo': 1, 'bar': 2, 'cow': 3});

              done();
            });
          });
        });
      });
    });
  });
});

/**
 * Verify remove API.
 */
it('remove', function(done) {
  const storage = this.storage;

  // Add some items.
  storage.setItems({'foo': 1, 'bar': 2}, () => {
    // Make sure things are in there.
    storage.getItems(null, (value) => {
      assert.deepEqual(value, {'foo': 1, 'bar': 2});

      // Remove the item.
      storage.removeItem('foo').then(() => {
        // Make sure it's gone.
        storage.getItems(null, (value) => {
          assert.deepEqual(value, {'bar': 2});

          done();
        });
      });
    });
  });
});

/**
 * Verify remove API with missing values.
 */
it('remove-missing', function(done) {
  const storage = this.storage;

  // Add some items.
  storage.setItems({'foo': 1, 'bar': 2}, () => {
    // Make sure things are in there.
    storage.getItems(null, (value) => {
      assert.deepEqual(value, {'foo': 1, 'bar': 2});

      // Remove unrelated item.
      storage.removeItem('f00').then(() => {
        // Make sure nothing is changed.
        storage.getItems(null, (value) => {
          assert.deepEqual(value, {'foo': 1, 'bar': 2});

          done();
        });
      });
    });
  });
});

/**
 * Verify removes API.
 */
it('removes', function(done) {
  const storage = this.storage;

  // Add some items.
  storage.setItems({'foo': 1, 'bar': 2, 'cow': 3}, () => {
    // Make sure things are in there.
    storage.getItems(null, (value) => {
      assert.deepEqual(value, {'foo': 1, 'bar': 2, 'cow': 3});

      // Remove some items.
      storage.removeItems(['foo', 'bar', 'blah']).then(() => {
        // Make sure it's gone.
        storage.getItems(null, (value) => {
          assert.deepEqual(value, {'cow': 3});

          done();
        });
      });
    });
  });
});

/**
 * Verify clear API.
 */
it('clear', function(done) {
  const storage = this.storage;

  // Add some items.
  storage.setItems({'foo': 1, 'bar': 2, 'cow': 3}, () => {
    // Make sure things are in there.
    storage.getItems(null, (value) => {
      assert.deepEqual(value, {'foo': 1, 'bar': 2, 'cow': 3});

      // Remove all items.
      storage.clear().then(() => {
        // Make sure it's gone.
        storage.getItems(null, (value) => {
          assert.deepEqual(value, {});

          done();
        });
      });
    });
  });
});

};
