// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Internationalization functions test suite.
 */

describe('intl-segmenter_tests.js', () => {

/**
 * Check handling of ascii characters.
 */
it('ascii', () => {
  const segmenter = new Intl.Segmenter('en');
  const it = segmenter.segment('asdf');
  let ret = it.next();
  assert.isFalse(ret.done);
  assert.equal('a', ret.value.segment);
  ret = it.next();
  assert.isFalse(ret.done);
  assert.equal('s', ret.value.segment);
  ret = it.next();
  assert.isFalse(ret.done);
  assert.equal('d', ret.value.segment);
  ret = it.next();
  assert.isFalse(ret.done);
  assert.equal('f', ret.value.segment);
  ret = it.next();
  assert.isTrue(ret.done);
  assert.isUndefined(ret.value);
});

/**
 * Check handling of narrow non-ascii characters.
 */
it('narrow', () => {
  const segmenter = new Intl.Segmenter('en');
  const it = segmenter.segment('\u{a0}d\u{1ffe}');
  let ret = it.next();
  assert.equal('\u{a0}', ret.value.segment);
  ret = it.next();
  assert.equal('d', ret.value.segment);
  ret = it.next();
  assert.equal('\u{1ffe}', ret.value.segment);
  ret = it.next();
  assert.isUndefined(ret.value);
});

/**
 * Check handling of combining characters.
 */
it('combining', () => {
  const segmenter = new Intl.Segmenter('en');
  const it = segmenter.segment('\u{30a}\u{30a}A\u{30a}b');
  let ret = it.next();
  let expected;
  // The v8 implementation is complete.  The fallback is broken.
  if ('v8BreakIterator' in Intl) {
    expected = ['\u{30a}\u{30a}', 'A\u{30a}', 'b'];
  } else {
    expected = ['\u{30a}', '\u{30a}', 'A', '\u{30a}', 'b'];
  }
  while (expected.length) {
    assert.equal(expected.shift(), ret.value.segment);
    ret = it.next();
  }
  assert.isUndefined(ret.value);
});

/**
 * Check handling of control characters.
 */
it('control', () => {
  const segmenter = new Intl.Segmenter('en');
  const it = segmenter.segment('\u{1}\u{2}\u{4}a\u{5}b');
  let ret = it.next();
  assert.equal('\u{1}', ret.value.segment);
  ret = it.next();
  assert.equal('\u{2}', ret.value.segment);
  ret = it.next();
  assert.equal('\u{4}', ret.value.segment);
  ret = it.next();
  assert.equal('a', ret.value.segment);
  ret = it.next();
  assert.equal('\u{5}', ret.value.segment);
  ret = it.next();
  assert.equal('b', ret.value.segment);
  ret = it.next();
  assert.isUndefined(ret.value);
});

});
