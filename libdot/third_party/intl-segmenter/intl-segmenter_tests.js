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
  const segments = Array.from(it);
  assert.equal(4, segments.length);
  assert.equal('a', segments[0].segment);
  assert.equal('s', segments[1].segment);
  assert.equal('d', segments[2].segment);
  assert.equal('f', segments[3].segment);
});

/**
 * Check handling of narrow non-ascii characters.
 */
it('narrow', () => {
  const segmenter = new Intl.Segmenter('en');
  const it = segmenter.segment('\u{a0}d\u{1ffe}');
  const segments = Array.from(it);
  assert.equal(3, segments.length);
  assert.equal('\u{a0}', segments[0].segment);
  assert.equal('d', segments[1].segment);
  assert.equal('\u{1ffe}', segments[2].segment);
});

/**
 * Check handling of combining characters.
 */
it('combining', () => {
  const segmenter = new Intl.Segmenter('en');
  const it = segmenter.segment('\u{30a}\u{30a}A\u{30a}b');
  const segments = Array.from(it);
  let expected;
  // The v8 implementation is complete.  The fallback is broken.
  if ('v8BreakIterator' in Intl) {
    expected = ['\u{30a}\u{30a}', 'A\u{30a}', 'b'];
  } else {
    expected = ['\u{30a}', '\u{30a}', 'A', '\u{30a}', 'b'];
  }
  assert.equal(expected.length, segments.length);
  for (let i = 0; i < expected.length; ++i) {
    assert.equal(expected[i], segments[i].segment);
  }
});

/**
 * Check handling of control characters.
 */
it('control', () => {
  const segmenter = new Intl.Segmenter('en');
  const it = segmenter.segment('\u{1}\u{2}\u{4}a\u{5}b');
  const segments = Array.from(it);
  assert.equal(6, segments.length);
  assert.equal('\u{1}', segments[0].segment);
  assert.equal('\u{2}', segments[1].segment);
  assert.equal('\u{4}', segments[2].segment);
  assert.equal('a', segments[3].segment);
  assert.equal('\u{5}', segments[4].segment);
  assert.equal('b', segments[5].segment);
});

});
