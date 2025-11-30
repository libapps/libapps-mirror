// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test framework setup when run inside the browser.
 */

import * as libTest from '../../libdot/js/lib_test_util.js';

import {init} from './terminal_common.js';

libTest.main({
  // TODO(lxj@google.com): Move preference manager into a module such that it is
  // no longer a global variable.
  globals: [
    'PreferenceManager',
    'preferenceManager',
    'storage',
  ],
});

/**
 * Setup that runs before all test suites.
 */
before(async function() {
  await init();
});

/**
 * @suppress {constantProperty} Allow tests in all browsers.
 */
window.chrome = window.chrome || {};
