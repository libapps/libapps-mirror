// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview nassh unit tests.  Specifically for core/high-level functions.
 */

nassh.Tests = new lib.TestManager.Suite('nassh.Tests');

/**
 * Test that basic message lookup works.
 */
nassh.Tests.addTest('nassh.msg', function(result, cx) {
  // Simple pass through.
  result.assertEQ('foo', nassh.msg('foo'));

  result.pass();
});
