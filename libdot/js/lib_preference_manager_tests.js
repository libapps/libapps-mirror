// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Unit tests for lib.PreferenceManager.
 */

import {lib} from '../index.js';

describe('lib_preference_manager_tests.js', () => {

/**
 * If another window changes a preference to the default it will delete the
 * localStorage entry. Here we mock the deleting of a localStorage entry so we
 * can test the window correctly return the default value.
 */
it('local-delete-default', (done) => {
  const storage = new lib.Storage.Local();
  const preferenceManager = new lib.PreferenceManager(storage);
  const defaultColor = 'red';

  preferenceManager.definePreference('color', defaultColor, function(value) {
    assert.strictEqual(value, defaultColor);
    done();
  });

  // Fake current value is 'blue'.
  preferenceManager.prefRecords_['color'].currentValue = 'blue';

  /**
   * Workaround bad extern in closure. cl/307771888
   *
   * @suppress {checkTypes}
   * @return {!StorageEvent}
   */
  function newEvent() {
    return new StorageEvent('storage', {
      storageArea: globalThis.localStorage,
      key: '/color',
      oldValue: JSON.stringify('blue'),
      newValue: null,
    });
  }
  // Simpulate deleting the key on another browser.
  const event = newEvent();
  globalThis.dispatchEvent(event);
});

/**
 * Verify export prefs works.
 */
it('export-json', () => {
  const storage = new lib.Storage.Memory();
  const manager = new lib.PreferenceManager(storage);

  // Declare prefs on the top object.  Change some, but keep some as defaults.
  manager.definePreferences([
    ['color', 'red'],
    ['lines', null],
  ]);
  manager.set('color', 'blue');

  // Declare children prefs since we will have to recurse into them.
  manager.defineChildren('profiles', function(parent, id) {
    const childManager = new lib.PreferenceManager(
        parent.storage, `/profiles/${id}`);
    childManager.definePreferences([
      ['host', 'localhost'],
      ['port', 22],
    ]);
    return childManager;
  });
  // Add a child with changed prefs.
  const child = manager.createChild('profiles', undefined, '1234');
  child.set('host', '::1');
  child.set('port', 443);
  // Add a child that uses the defaults.
  manager.createChild('profiles', undefined, '2222');

  // Export the prefs and make sure it works.
  const prefs = manager.exportAsJson();
  assert.deepStrictEqual(prefs, {
    color: 'blue',
    profiles: [
      {
        id: '1234',
        json: {
          host: '::1',
          port: 443,
        },
      },
      {
        id: '2222',
        json: {},
      },
    ],
  });
});

/**
 * Verify import prefs works.
 */
it('import-json', async () => {
  const storage = new lib.Storage.Memory();
  const manager = new lib.PreferenceManager(storage);

  // Declare prefs on the top object.  Change their values from what we import.
  manager.definePreferences([
    ['color', 'red'],
    ['lines', null],
  ]);
  manager.set('color', 'green');
  manager.set('lines', 10);

  // Declare children prefs since we will have to recurse into them.
  manager.defineChildren('profiles', function(parent, id) {
    const childManager = new lib.PreferenceManager(
        parent.storage, `/profiles/${id}`);
    childManager.definePreferences([
      ['host', 'localhost'],
      ['port', 22],
    ]);
    return childManager;
  });
  // Add some children that won't match.
  const child = manager.createChild('profiles', undefined, '6666');
  child.set('host', '::1');
  child.set('port', 443);
  // Add a child that uses the defaults.
  manager.createChild('profiles', undefined, '7777');
  // Add a child that will be overwritten.
  manager.createChild('profiles', undefined, '1234');
  child.set('host', 'remote');

  // Import a completely diff set of prefs.
  const newPrefs = {
    color: 'blue',
    profiles: [
      {
        id: '1234',
        json: {
          host: '::1',
          port: 443,
        },
      },
      {
        id: '2222',
        json: {},
      },
    ],
  };
  await manager.importFromJson(newPrefs);
  // Export the prefs and make sure it matches.
  const prefs = manager.exportAsJson();
  assert.deepStrictEqual(prefs, newPrefs);
});


/**
 * Verify changing prefix works.
 */
it('change-prefix', async () => {
  const storage = new lib.Storage.Memory();
  // a: p1 and p2 have custom value.
  // b: p1 has custom value.
  // c: p2 has custom value.
  // d: no custom values.
  storage.setItems({
    '/p1/a': 'p1a',
    '/p1/b': 'p1b',
    '/p2/a': 'p2a',
    '/p2/c': 'p2c',
  });
  const manager = new lib.PreferenceManager(storage, '/p1');
  manager.definePreferences([
    ['a', 'a'],
    ['b', 'b'],
    ['c', 'c'],
    ['d', 'd'],
  ]);
  await new Promise((resolve) => manager.readStorage(resolve));

  const observed = {};
  let observerCount = 0;
  for (const c of 'abcd') {
    manager.addObserver(c, (value, key) => {
      observed[key] = value;
      observerCount++;
    });
  }

  // Observe all prefs for '/p1'.
  manager.notifyAll();
  assert.deepStrictEqual({a: 'p1a', b: 'p1b', c: 'c', d: 'd'}, observed);
  assert.equal(4, observerCount);
  assert.equal('p1a', manager.get('a'));
  assert.equal('p1b', manager.get('b'));
  assert.equal('c', manager.get('c'));
  assert.equal('d', manager.get('d'));

  // Change prefix to '/p2', and validate.
  let prefixObserved;
  manager.onPrefixChange.addListener((value) => {
    prefixObserved = value;
    // This should be called before prefs are notified.
    assert.equal(4, observerCount);
  });
  await new Promise((resolve) => manager.setPrefix('/p2', resolve));
  assert.equal('/p2/', prefixObserved);
  assert.deepStrictEqual({a: 'p2a', b: 'b', c: 'p2c', d: 'd'}, observed);
  assert.equal(8, observerCount);
  assert.equal('p2a', manager.get('a'));
  assert.equal('b', manager.get('b'));
  assert.equal('p2c', manager.get('c'));
  assert.equal('d', manager.get('d'));
});

/**
 * Verify we always return a copy of array or objects.
 */
it('get-array-or-object-returns-copy', async () => {
  const storage = new lib.Storage.Memory();
  const manager = new lib.PreferenceManager(storage);
  const defaultObject = {default: true};
  const defaultArray = ['default', 'array'];
  manager.definePreferences([
    ['object', defaultObject],
    ['array', defaultArray],
  ]);
  await new Promise((resolve) => manager.readStorage(resolve));

  // Check when value is default.
  let o = /** @type {!Object} */(manager.get('object'));
  assert.notEqual(o, defaultObject);
  assert.deepEqual(o, defaultObject);
  o['changed'] = true;
  assert.isUndefined(defaultObject['changed']);
  let a = /** @type {!Array} */(manager.get('array'));
  assert.notEqual(a, defaultArray);
  assert.deepEqual(a, defaultArray);
  a.push('changed');
  assert.equal(defaultArray.length, 2);

  // Check when value is not default
  const notDefaultObject = {notDefault: true};
  const notDefaultArray = ['notdefault', 'array'];
  manager.set('object', notDefaultObject);
  manager.set('array', notDefaultArray);
  o = /** @type {!Object} */(manager.get('object'));
  assert.notEqual(o, notDefaultObject);
  assert.deepEqual(o, notDefaultObject);
  o['changed'] = true;
  assert.isUndefined(notDefaultObject['changed']);
  a = /** @type {!Array} */(manager.get('array'));
  assert.notEqual(a, notDefaultArray);
  assert.deepEqual(a, notDefaultArray);
  a.push('changed');
  assert.equal(notDefaultArray.length, 2);
});

/**
 * Verify we clear storage when we set an object back to its default value.
 */
it('set-array-or-object-detects-default', async () => {
  const storage = new lib.Storage.Memory();
  const manager = new lib.PreferenceManager(storage);
  const defaultObject = {default: true};
  const defaultArray = ['default', 'array'];
  manager.definePreferences([
    ['object', defaultObject],
    ['array', defaultArray],
  ]);
  await new Promise((resolve) => manager.readStorage(resolve));

  assert.isUndefined(await storage.getItem('/object'));
  assert.isUndefined(await storage.getItem('/array'));
  manager.set('object', {notdefault: true});
  manager.set('array', ['notdefault', 'array']);
  assert.isDefined(await storage.getItem('/object'));
  assert.isDefined(await storage.getItem('/array'));
  manager.set('object', {default: true});
  manager.set('array', ['default', 'array']);
  assert.isUndefined(await storage.getItem('/object'));
  assert.isUndefined(await storage.getItem('/array'));
});
});
