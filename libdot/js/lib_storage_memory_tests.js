// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test suite for memory storage.
 */

import {lib} from '../index.js';
import {storageApiTest} from './lib_storage_test_util.js';

describe('lib_storage_memory_tests.js', () => {

/**
 * Initialize the storage fakes & APIs.
 */
beforeEach(function() {
  this.storage = new lib.Storage.Memory();
});

storageApiTest();

});
