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

describe('lib_punycode_tests.js', () => {

it('encode', () => {
  // No change.
  assert.equal(lib.punycode.encode('example.com'), 'example.com-');

  // Basic unicode conversion.
  assert.equal(lib.punycode.encode('日本'), 'wgv71a');
});

it('decode', () => {
  // No change.
  assert.equal(lib.punycode.decode('example.com-'), 'example.com');

  // Basic unicode conversion.
  assert.equal(lib.punycode.decode('wgv71a'), '日本');
});

it('toASCII', () => {
  // No change.
  assert.equal(lib.punycode.toASCII('example.com'), 'example.com');

  // Basic unicode conversion.
  assert.equal(lib.punycode.toASCII('日本.com'), 'xn--wgv71a.com');
});

it('toUnicode', () => {
  // No change.
  assert.equal(lib.punycode.toUnicode('example.com'), 'example.com');

  // Basic unicode conversion.
  assert.equal(lib.punycode.toUnicode('xn--wgv71a.com'), '日本.com');
});

});
