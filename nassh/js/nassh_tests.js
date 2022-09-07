// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview nassh unit tests.  Specifically for core/high-level functions.
 */

import {
  base64ToBase64Url, base64UrlToBase64, localize, osc8Link, sgrSequence,
  sgrText,
} from './nassh.js';

describe('nassh_tests.js', () => {

/**
 * Test that basic message lookup works.
 */
it('localize', () => {
  // Simple pass through.
  assert.equal('foo', localize('foo'));
});

/**
 * Test base64url conversion.
 */
it('nassh.base64url-to-base64', () => {
  // The basic alphabet that should be unchanged (other than added padding).
  const base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  assert.equal(`${base}==`, base64UrlToBase64(base));

  // Check padding handling specifically.
  assert.equal('fooo', base64UrlToBase64('fooo'));
  assert.equal('foo=', base64UrlToBase64('foo'));
  assert.equal('fo==', base64UrlToBase64('fo'));

  // Check the important characters get converted.
  assert.equal('+/+/', base64UrlToBase64('-_+/'));
});

/**
 * Test base64 conversion.
 */
it('nassh.base64-to-base64url', () => {
  // The basic alphabet that should be unchanged;
  const base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  assert.equal(base, base64ToBase64Url(base));

  // Check = stripping.
  assert.equal('foo', base64ToBase64Url('foo='));
  assert.equal('fo', base64ToBase64Url('fo=='));

  // Check the important characters get converted.
  assert.equal('-_-_', base64ToBase64Url('-_+/'));
});

/**
 * Test SGR helper.
 */
it('nassh.SGR-sequence', () => {
  assert.equal('\x1b[m', sgrSequence());
  assert.equal('\x1b[1m', sgrSequence({bold: true}));
  assert.equal('\x1b[4m', sgrSequence({underline: true}));
  assert.equal('\x1b[1;4m', sgrSequence({bold: true, underline: true}));
  assert.equal('\x1b[33;40m', sgrSequence({fg: 33, bg: 40}));
  assert.equal('\x1b[1;33;40m',
               sgrSequence({bold: true, fg: 33, bg: 40}));
});

/**
 * Test SGR text helper.
 */
it('nassh.SGR-text', () => {
  // NB: We lightly test this func as most logic is in sgrSequence().
  assert.equal('\x1b[mfoo\x1b[m', sgrText('foo'));
  assert.equal('\x1b[1mfoo\x1b[m', sgrText('foo', {bold: true}));
});

/**
 * Test OSC-8 text helper.
 */
it('nassh.OSC-8-link', () => {
  assert.equal('\x1b]8;;https://example.com\x07https://example.com\x1b]8;;\x07',
               osc8Link('https://example.com'));
  assert.equal('\x1b]8;;https://example.com\x07foo\x1b]8;;\x07',
               osc8Link('https://example.com', 'foo'));
});

});
