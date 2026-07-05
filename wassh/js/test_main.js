// Copyright 2026 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test framework setup when run inside the browser.
 */

import * as libTest from '../../libdot/js/lib_test_util.js';

libTest.main({
  base: '../../wassh',
  files: [
    // go/keep-sorted start
    'js/sockets_tests.js',
    // go/keep-sorted end
  ],
});
