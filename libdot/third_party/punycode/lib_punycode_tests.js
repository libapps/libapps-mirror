// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Punycode functions test suite.
 *
 * We don't test this too heavily as upstream has their own extensive
 * testsuite.  We just make sure basic integration with libdot works.
 */

lib.punycode.Tests = new lib.TestManager.Suite('lib.punycode.Tests');

lib.punycode.Tests.addTest('encode', function(result, cx) {
  // No change.
  result.assertEQ(lib.punycode.encode('example.com'), 'example.com-');

  // Basic unicode conversion.
  result.assertEQ(lib.punycode.encode('日本'), 'wgv71a');

  result.pass();
});

lib.punycode.Tests.addTest('decode', function(result, cx) {
  // No change.
  result.assertEQ(lib.punycode.decode('example.com-'), 'example.com');

  // Basic unicode conversion.
  result.assertEQ(lib.punycode.decode('wgv71a'), '日本');

  result.pass();
});

lib.punycode.Tests.addTest('toASCII', function(result, cx) {
  // No change.
  result.assertEQ(lib.punycode.toASCII('example.com'), 'example.com');

  // Basic unicode conversion.
  result.assertEQ(lib.punycode.toASCII('日本.com'), 'xn--wgv71a.com');

  result.pass();
});

lib.punycode.Tests.addTest('toUnicode', function(result, cx) {
  // No change.
  result.assertEQ(lib.punycode.toUnicode('example.com'), 'example.com');

  // Basic unicode conversion.
  result.assertEQ(lib.punycode.toUnicode('xn--wgv71a.com'), '日本.com');

  result.pass();
});
