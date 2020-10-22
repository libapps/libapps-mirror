// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Shim to export resources used by libdot.
 * @suppress {moduleLoad,undefinedVars} closure compiler can't handle this.
 */

import pkg from '../package.json';

lib.resource.add('libdot/changelog/version', 'text/plain', pkg.version);
lib.resource.add('libdot/changelog/date', 'text/plain', pkg.gitDate);
