// Copyright 2013 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test framework setup when run inside the browser.
 */

import * as libTest from './lib_test_util.js';

libTest.main({
  base: '../js',
  files: [
    // go/keep-sorted start
    'lib_codec_tests.js',
    'lib_colors_tests.js',
    'lib_event_tests.js',
    'lib_f_tests.js',
    'lib_i18n_tests.js',
    'lib_message_manager_tests.js',
    'lib_polyfill_tests.js',
    'lib_preference_manager_tests.js',
    'lib_storage_chrome_tests.js',
    'lib_storage_condenser_tests.js',
    'lib_storage_local_tests.js',
    'lib_storage_memory_tests.js',
    'lib_storage_terminal_private_tests.js',
    // go/keep-sorted end
  ],
});
