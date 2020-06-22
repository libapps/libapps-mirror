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
it('get-set', async function() {
  const storage = this.storage;

  // Make sure we can set an item and read it back out.
  let value = await storage.getItem('foo');
  assert.isUndefined(value);

  await storage.setItem('foo', 1);
  value = await storage.getItem('foo');
  assert.equal(value, 1);
});

/**
 * Verify multiple get/set APIs.
 */
it('gets-sets', async function() {
  const storage = this.storage;

  let value = await storage.getItems(null);
  assert.deepEqual(value, {});

  value = await storage.getItems(['foo']);
  assert.deepEqual(value, {});

  await storage.setItems({'foo': 1, 'bar': 2, 'cow': 3});
  value = await storage.getItems(['foo']);
  assert.deepEqual(value, {'foo': 1});

  value = await storage.getItems(['foo', 'bar']);
  assert.deepEqual(value, {'foo': 1, 'bar': 2});

  value = await storage.getItems(null);
  assert.deepEqual(value, {'foo': 1, 'bar': 2, 'cow': 3});
});

/**
 * Verify remove API.
 */
it('remove', async function() {
  const storage = this.storage;

  // Add some items.
  await storage.setItems({'foo': 1, 'bar': 2});

  // Make sure things are in there.
  let value = await storage.getItems(null);
  assert.deepEqual(value, {'foo': 1, 'bar': 2});

  // Remove the item.
  await storage.removeItem('foo');

  // Make sure it's gone.
  value = await storage.getItems(null);
  assert.deepEqual(value, {'bar': 2});
});

/**
 * Verify remove API with missing values.
 */
it('remove-missing', async function() {
  const storage = this.storage;

  // Add some items.
  await storage.setItems({'foo': 1, 'bar': 2});

  // Make sure things are in there.
  let value = await storage.getItems(null);
  assert.deepEqual(value, {'foo': 1, 'bar': 2});

  // Remove unrelated item.
  await storage.removeItem('f00');

  // Make sure nothing is changed.
  value = await storage.getItems(null);
  assert.deepEqual(value, {'foo': 1, 'bar': 2});
});

/**
 * Verify removes API.
 */
it('removes', async function() {
  const storage = this.storage;

  // Add some items.
  await storage.setItems({'foo': 1, 'bar': 2, 'cow': 3});

  // Make sure things are in there.
  let value = await storage.getItems(null);
  assert.deepEqual(value, {'foo': 1, 'bar': 2, 'cow': 3});

  // Remove some items.
  await storage.removeItems(['foo', 'bar', 'blah']);

  // Make sure it's gone.
  value = await storage.getItems(null);
  assert.deepEqual(value, {'cow': 3});
});

/**
 * Verify clear API.
 */
it('clear', async function() {
  const storage = this.storage;

  // Add some items.
  await storage.setItems({'foo': 1, 'bar': 2, 'cow': 3});

  // Make sure things are in there.
  let value = await storage.getItems(null);
  assert.deepEqual(value, {'foo': 1, 'bar': 2, 'cow': 3});

  // Remove all items.
  await storage.clear();

  // Make sure it's gone.
  value = await storage.getItems(null);
  assert.deepEqual(value, {});
});

};
