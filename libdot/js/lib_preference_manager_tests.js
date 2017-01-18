// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Unit tests for lib.PreferenceManager.
 */
lib.PreferenceManager.Tests = lib.TestManager.Suite('lib.PreferenceManager.Tests');

/**
 * If another window changes a preference to the default it will delete the
 * localStorage entry. Here we mock the deleting of a localStorage entry so we
 * can test the window correctly return the default value.
 */
lib.PreferenceManager.Tests.addTest('local-delete-default', function(result, cx) {
  var storage = new lib.Storage.Local();
  var preferenceManager = new lib.PreferenceManager(storage);
  var defaultColor = 'red';

  preferenceManager.definePreference('color', defaultColor, function(value) {
    result.assertEQ(value, defaultColor);
    result.pass();
  });

  // Fake current value is 'blue'.
  preferenceManager.prefRecords_.color.currentValue = 'blue';

  // Simpulate deleting the key on another browser.
  var event = new Event('storage');
  event.storageArea = window.localStorage;
  event.key = '/color';
  event.oldValue = JSON.stringify('blue');
  event.newValue = null;
  window.dispatchEvent(event);

  result.requestTime(100);
});
