// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Various codec test suites.
 */

lib.codec.Tests = new lib.TestManager.Suite('lib.codec.Tests');

/**
 * Test code unit array conversions to strings.
 */
lib.codec.Tests.addTest('codeUnitArrayToString', function(result, cx) {
  // Check default Array handling.
  result.assertEQ('asdf', lib.codec.codeUnitArrayToString([97, 115, 100, 102]));

  // Check UTF-16 pairs.
  result.assertEQ('\u{1fadc}', lib.codec.codeUnitArrayToString([55358, 57052]));

  result.pass();
});

/**
 * Test string conversions to code unit arrays.
 */
lib.codec.Tests.addTest('stringToCodeUnitArray', function(result, cx) {
  let ret;

  // Check default Array handling.
  ret = lib.codec.stringToCodeUnitArray('asdf');
  result.assertEQ([97, 115, 100, 102], ret);
  result.assert(Array.isArray(ret));

  // Check UTF-16 pairs.
  result.assertEQ([55358, 57052], lib.codec.stringToCodeUnitArray('\u{1fadc}'));

  result.pass();
});
