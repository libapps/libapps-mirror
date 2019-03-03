// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview nassh unit tests.  Specifically for core/high-level functions.
 */

describe('nassh_tests.js', () => {

/**
 * Test that basic message lookup works.
 */
it('nassh.msg', () => {
  // Simple pass through.
  assert.equal('foo', nassh.msg('foo'));
});

/**
 * Test base64url conversion.
 */
it('nassh.base64url-to-base64', () => {
  // The basic alphabet that should be unchanged (other than added padding).
  const base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  assert.equal(`${base}==`, nassh.base64UrlToBase64(base));

  // Check padding handling specifically.
  assert.equal('fooo', nassh.base64UrlToBase64('fooo'));
  assert.equal('foo=', nassh.base64UrlToBase64('foo'));
  assert.equal('fo==', nassh.base64UrlToBase64('fo'));

  // Check the important characters get converted.
  assert.equal('+/+/', nassh.base64UrlToBase64('-_+/'));
});

/**
 * Test base64 conversion.
 */
it('nassh.base64-to-base64url', () => {
  // The basic alphabet that should be unchanged;
  const base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  assert.equal(base, nassh.base64ToBase64Url(base));

  // Check = stripping.
  assert.equal('foo', nassh.base64ToBase64Url('foo='));
  assert.equal('fo', nassh.base64ToBase64Url('fo=='));

  // Check the important characters get converted.
  assert.equal('-_-_', nassh.base64ToBase64Url('-_+/'));
});

});
