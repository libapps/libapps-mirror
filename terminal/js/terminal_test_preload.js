// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test framework setup when run inside the browser.
 * @suppress {moduleLoad} closure compiler can't handle node_modules/.
 */

import {assert} from '../../node_modules/chai/chai.js';

// Add a global shortcut to the assert API.
globalThis['assert'] = assert;
