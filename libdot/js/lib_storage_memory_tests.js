// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Test suite for memory storage.
 */

describe('lib_storage_memory_tests.js', () => {

/**
 * Initialize the storage fakes & APIs.
 */
beforeEach(function() {
  this.storage = new lib.Storage.Memory();
});

lib.Storage.ApiTest();

});
