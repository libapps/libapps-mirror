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
 * @param {!Object} storage The storage object under test.
 * @return {boolean} Whether the storage type supports event testing.
 */
function storageSupportsEventTests(storage) {
  // We can't test Local storage directly.  sessionStorage never fires events,
  // and localStorage doesn't fire in the same page.  So there's that.
  // https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
  return !(storage instanceof lib.Storage.Local);
}

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

/**
 * Verify add/removing observers.
 */
it('observe-add-remove', async function() {
  const storage = this.storage;

  if (!storageSupportsEventTests(storage)) {
    this.skip();
    return;
  }

  // Unknown or empty should not crash.
  storage.removeObserver(() => {});

  const seen1 = [];
  const ob1 = (e) => seen1.push(e);

  const seen2 = [];
  const ob2 = (e) => seen2.push(e);

  // Neither should see this.
  await storage.setItem('empty', '');

  storage.addObserver(ob1);
  storage.addObserver(ob2);

  // Both should see this.
  await storage.setItem('k', 'v');

  storage.removeObserver(ob1);

  // Only ob2 should see this.
  await storage.removeItem('k');

  storage.removeObserver(ob2);

  // Neither should see this.
  await storage.setItem('k2', 'v2');

  assert.deepEqual(seen1, [
    {'k': {newValue: 'v'}},
  ]);
  assert.deepEqual(seen2, [
    {'k': {newValue: 'v'}},
    {'k': {oldValue: 'v'}},
  ]);
});

/**
 * Verify observer notifications.
 */
it('observe', function(done) {
  const storage = this.storage;

  if (!storageSupportsEventTests(storage)) {
    this.skip();
    return;
  }

  // All the events we should see in order.
  const exp = [
    {a: {newValue: '1'}},
    {a: {oldValue: '1', newValue: '2'}},
  ];
  const events = [];

  storage.addObserver((e) => events.push(e));
  storage.setItem('a', '1').then(() => {
    storage.setItem('a', '2');
  });

  // Poll to finish asap, but don't give up too soon.
  let retry = 200;
  const check = () => {
    if (events.length >= exp.length) {
      assert.deepEqual(events, exp);
      done();
    } else if (retry-- > 0) {
      setTimeout(check, 1);
    } else {
      assert.fail();
    }
  };
  check();
});

};
