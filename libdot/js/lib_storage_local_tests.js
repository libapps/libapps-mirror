// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Test suite for local storage.
 */

describe('lib_storage_local_tests.js', () => {

/**
 * Initialize the storage fakes & APIs.
 */
beforeEach(function() {
  // Make sure other/previous tests don't leak.
  window.sessionStorage.clear();

  this.storage = new lib.Storage.Local(window.sessionStorage);
});

lib.Storage.ApiTest();

});
