// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Common storage API tests.
 */

import {lib} from '../index.js';

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
 * This is mocha.Context with extra stuff attached.
 *
 * @typedef {{
 *   skip: function(),
 *   storage: !lib.Storage,
 * }}
 */
let StorageContext;

/**
 * Verify single get/set APIs.
 *
 * @this {!StorageContext}
 */
async function testGetSet() {
  const storage = this.storage;

  // Make sure we can set an item and read it back out.
  let value = await storage.getItem('foo');
  assert.isUndefined(value);

  await storage.setItem('foo', 1);
  value = await storage.getItem('foo');
  assert.equal(value, 1);

  // Adding another item should leave existing ones alone.
  await storage.setItem('bar', 2);
  value = await storage.getItem('bar');
  assert.equal(value, 2);
  value = await storage.getItem('foo');
  assert.equal(value, 1);
}

/**
 * Verify multiple get/set APIs.
 *
 * @this {!StorageContext}
 */
async function testGetsSets() {
  const storage = this.storage;

  let value = await storage.getItems(null);
  assert.deepEqual(value, {});

  const key = ['foo'];
  value = await storage.getItems(key);
  assert.deepEqual(value, {});
  assert.deepEqual(key, ['foo']);

  await storage.setItems({'foo': 1, 'bar': 2, 'cow': 3});
  value = await storage.getItems(['foo']);
  assert.deepEqual(value, {'foo': 1});

  value = await storage.getItems(['foo', 'bar']);
  assert.deepEqual(value, {'foo': 1, 'bar': 2});

  value = await storage.getItems(null);
  assert.deepEqual(value, {'foo': 1, 'bar': 2, 'cow': 3});

  // Changing one item should leave existing ones alone.
  await storage.setItems({'cow': 4});
  value = await storage.getItems(null);
  assert.deepEqual(value, {'foo': 1, 'bar': 2, 'cow': 4});
}

/**
 * Verify remove API.
 *
 * @this {!StorageContext}
 */
async function testRemove() {
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
}

/**
 * Verify remove API with missing values.
 *
 * @this {!StorageContext}
 */
async function testRemoveMissing() {
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
}

/**
 * Verify removes API.
 *
 * @this {!StorageContext}
 */
async function testRemoves() {
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
}

/**
 * Verify clear API.
 *
 * @this {!StorageContext}
 */
async function testClear() {
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
}

/**
 * Verify add/removing observers.
 *
 * @this {!StorageContext}
 */
async function testObserveAddRemove() {
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
}

/**
 * Verify observer notifications.
 *
 * @param {function(): void} done
 * @this {!StorageContext}
 */
function testObserve(done) {
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
}

/**
 * Testsuite for the generic storage API.
 *
 * Each implementation should call this to verify functionality.
 */
export function storageApiTest() {
  it('get_set', testGetSet);
  it('gets-sets', testGetsSets);
  it('remove', testRemove);
  it('remove-missing', testRemoveMissing);
  it('removes', testRemoves);
  it('clear', testClear);
  it('observe-add-remove', testObserveAddRemove);
  it('observe', testObserve);
}
