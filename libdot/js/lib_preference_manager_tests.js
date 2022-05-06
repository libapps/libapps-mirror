// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Unit tests for lib.PreferenceManager.
 */

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
      storageArea: window.localStorage,
      key: '/color',
      oldValue: JSON.stringify('blue'),
      newValue: null,
    });
  }
  // Simpulate deleting the key on another browser.
  const event = newEvent();
  window.dispatchEvent(event);
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
it('import-json', (done) => {
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
  // We'll get three callbacks -- one for each preference manager.  Wait until
  // the final one to check the state.
  let callbacks = 3;
  manager.importFromJson(newPrefs, () => {
    // Export the prefs and make sure it matches.
    const prefs = manager.exportAsJson();
    if (--callbacks === 0) {
      assert.deepStrictEqual(prefs, newPrefs);
      done();
    }
  });
});

});
