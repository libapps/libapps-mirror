// Copyright 2014 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {hterm} from '../../index.js';

describe('3pp_wc_tests.js', () => {

it('strWidth-test', () => {
  const asciiOnechar = 'a';
  const asciiString = 'an ascii string';
  const widecharOnechar = '\u4E2D';
  const widecharString = '\u4E2D\u6587\u5B57\u4E32';
  const ambiguousOnechar = '\u2026'; // Horizontal ellipsis
  const mixedString = '\u4E2D\u6587 English';
  const nullChar = '\u0000';
  const controlChar = '\r';
  const musicalSign = '\uD834\uDD00';
  const wideSurrogatePair = '\uD842\uDD9D';  // U+2099d 𠦝
  const narrowSurrogatePair = '\uD83D\uDE6B';  // U+1f66b 🙫
  const combiningChar = 'A\u030A';

  assert.equal(1, hterm.wc.strWidth(asciiOnechar), 'ASCII char has wcwidth 1');
  assert.equal(15, hterm.wc.strWidth(asciiString), 'ASCII string');
  assert.equal(2, hterm.wc.strWidth(widecharOnechar),
               'Chinese char has width 2');
  assert.equal(8, hterm.wc.strWidth(widecharString), 'Widechar string');
  assert.equal(1, hterm.wc.strWidth(ambiguousOnechar),
               'East Asian Ambiguous character has width 1');
  assert.equal(12, hterm.wc.strWidth(mixedString), 'Mixed string');
  assert.equal(0, hterm.wc.strWidth(nullChar), 'Null char has wcwdith 0');
  assert.equal(0, hterm.wc.strWidth(controlChar), 'Control char has width 0');
  assert.equal(1, hterm.wc.strWidth(musicalSign),
               'Surrogate pair is considered a single character');
  assert.equal(2, hterm.wc.strWidth(wideSurrogatePair),
               'Wide character represented in a surrogate pair');
  assert.equal(1, hterm.wc.strWidth(narrowSurrogatePair),
               'Narrow character represented in a surrogate pair');
  assert.equal(1, hterm.wc.strWidth(combiningChar), 'A combining character');
});

/**
 * Verify behavior for all codepoints below 0xa0.  It's quick & easy to do so,
 * and this func has optimizations for them specifically.
 */
it('charWidthDisregardAmbiguous-low', () => {
  let i;

  for (i = 0; i < 0x20; ++i) {
    assert.equal(0, hterm.wc.charWidthDisregardAmbiguous(i));
  }

  for (i = 0x20; i < 0x7f; ++i) {
    assert.equal(1, hterm.wc.charWidthDisregardAmbiguous(i));
  }

  for (i = 0x7f; i < 0xa0; ++i) {
    assert.equal(0, hterm.wc.charWidthDisregardAmbiguous(i));
  }
});

it('charWidthRegardAmbiguous-test', () => {
  const asciiChar = 'a';
  const wideChar = '\u4E2D';
  const ambiguousChar = '\u2026'; // Horizontal ellipsis
  const nullChar = '\u0000';
  const controlChar = '\r';

  assert.equal(1, hterm.wc.charWidthRegardAmbiguous(asciiChar.charCodeAt(0)),
               'ASCII char has width 1');
  assert.equal(2, hterm.wc.charWidthRegardAmbiguous(wideChar.charCodeAt(0)),
               'Chinese char has width 2');
  assert.equal(2,
               hterm.wc.charWidthRegardAmbiguous(ambiguousChar.charCodeAt(0)),
               'East Asian Ambiguous character has width 2');
  assert.equal(0, hterm.wc.charWidthRegardAmbiguous(nullChar.charCodeAt(0)),
               'Null char has wcwdith 0');
  assert.equal(0, hterm.wc.charWidthRegardAmbiguous(controlChar.charCodeAt(0)),
               'Control char has width 0');
});

it('substr-test', () => {
  const asciiOnechar = '1';
  const asciiString = '1234567890';
  const widecharOnechar = '\u4E2D';
  const widecharString = '\u4E2D\u6587\u5B57\u4E32\u4E2D\u6587\u5B57\u4E32';
  const mixedString = '12345\u4E2D\u6587\u5B57\u4E3267890';
  const combiningString = '123A\u030A456';
  const leadingCombiningString = '\u{30a}x';

  assert.equal('1', hterm.wc.substr(asciiOnechar, 0, 1));
  assert.equal('1', hterm.wc.substr(asciiOnechar, 0, 2));
  assert.equal('1', hterm.wc.substr(asciiOnechar, 0));
  assert.equal('', hterm.wc.substr(asciiOnechar, 0, 0));
  assert.equal('', hterm.wc.substr(asciiOnechar, 1));

  assert.equal('1234', hterm.wc.substr(asciiString, 0, 4));
  assert.equal('1234567890', hterm.wc.substr(asciiString, 0, 15));
  assert.equal('5678', hterm.wc.substr(asciiString, 4, 4));
  assert.equal('567890', hterm.wc.substr(asciiString, 4, 10));
  assert.equal('67890', hterm.wc.substr(asciiString, 5));
  assert.equal('', hterm.wc.substr(asciiString, 0, 0));
  assert.equal('', hterm.wc.substr(asciiString, 11));

  assert.equal('\u4E2D', hterm.wc.substr(widecharOnechar, 0, 2));
  assert.equal('\u4E2D', hterm.wc.substr(widecharOnechar, 0, 3));
  assert.equal('\u4E2D', hterm.wc.substr(widecharOnechar, 0));
  assert.equal('\u4E2D', hterm.wc.substr(widecharOnechar, 1));
  assert.equal('', hterm.wc.substr(widecharOnechar, 0, 0));
  assert.equal('', hterm.wc.substr(widecharOnechar, 0, 1));
  assert.equal('', hterm.wc.substr(widecharOnechar, 2));

  assert.equal('\u4E2D\u6587', hterm.wc.substr(widecharString, 0, 4));
  assert.equal('\u4E2D\u6587', hterm.wc.substr(widecharString, 0, 5));
  assert.equal('\u4E2D\u6587\u5B57\u4E32\u4E2D\u6587\u5B57\u4E32',
               hterm.wc.substr(widecharString, 0, 20));
  assert.equal('\u5B57\u4E32', hterm.wc.substr(widecharString, 4, 4));
  assert.equal('\u5B57\u4E32\u4E2D\u6587\u5B57\u4E32',
               hterm.wc.substr(widecharString, 4, 20));
  assert.equal('\u5B57\u4E32\u4E2D\u6587\u5B57\u4E32',
               hterm.wc.substr(widecharString, 5));
  assert.equal('', hterm.wc.substr(widecharString, 0, 0));
  assert.equal('', hterm.wc.substr(widecharString, 17));

  assert.equal('12345\u4E2D', hterm.wc.substr(mixedString, 0, 7));
  assert.equal(mixedString, hterm.wc.substr(mixedString, 0));
  assert.equal(mixedString, hterm.wc.substr(mixedString, 0, 20));

  assert.equal('123A\u030a456', hterm.wc.substr(combiningString, 0, 7));
  assert.equal('123A\u030a', hterm.wc.substr(combiningString, 0, 4));
  assert.equal('123', hterm.wc.substr(combiningString, 0, 3));
  assert.equal('3A\u030a', hterm.wc.substr(combiningString, 2, 2));
  assert.equal('A\u030a4', hterm.wc.substr(combiningString, 3, 2));
  assert.equal('A\u030a', hterm.wc.substr(combiningString, 3, 1));

  assert.equal(leadingCombiningString,
               hterm.wc.substr(leadingCombiningString, 0));
});

it('substr-wide-surrogate-test', () => {
  const string = '12\u{2099d}34';

  // Check this string actually contains a surrogate pair.
  assert.equal(6, string.length);

  assert.equal(string, hterm.wc.substr(string, 0));
  assert.equal('12', hterm.wc.substr(string, 0, 2));
  assert.equal('2', hterm.wc.substr(string, 1, 2));
  assert.equal('2\u{D842}\u{DD9D}', hterm.wc.substr(string, 1, 3));
  assert.equal('2\u{D842}\u{DD9D}3', hterm.wc.substr(string, 1, 4));
  assert.equal('', hterm.wc.substr(string, 2, 1));
  assert.equal('\u{D842}\u{DD9D}', hterm.wc.substr(string, 2, 2));
  assert.equal('\u{D842}\u{DD9D}3', hterm.wc.substr(string, 2, 3));
  // We don't test column 3 here as it's unclear what the right answer is.
  // That'll be in the middle of the wide character (column wise).
  assert.equal('3', hterm.wc.substr(string, 4, 1));
  assert.equal('34', hterm.wc.substr(string, 4));
});

it('substr-narrow-surrogate-test', () => {
  const string = '12\u{1f66b}34';

  // Check this string actually contains a surrogate pair.
  assert.equal(6, string.length);

  assert.equal(string, hterm.wc.substr(string, 0));
  assert.equal('12', hterm.wc.substr(string, 0, 2));
  assert.equal('2\u{1f66b}', hterm.wc.substr(string, 1, 2));
  assert.equal('2\u{1f66b}3', hterm.wc.substr(string, 1, 3));
  assert.equal('\u{1f66b}', hterm.wc.substr(string, 2, 1));
  assert.equal('\u{1f66b}3', hterm.wc.substr(string, 2, 2));
  assert.equal('3', hterm.wc.substr(string, 3, 1));
  assert.equal('34', hterm.wc.substr(string, 3));
});

it('substring-test', () => {
  const asciiString = '1234567890';
  const widecharString = '\u4E2D\u6587\u5B57\u4E32\u4E2D\u6587\u5B57\u4E32';
  const mixedString = '12345\u4E2D\u6587\u5B57\u4E3267890';

  assert.equal('\u6587\u5B57',
               hterm.wc.substring(widecharString, 2, 6));
  assert.equal('\u6587\u5B57',
               hterm.wc.substring(widecharString, 3, 7));
  assert.equal('\u4E2D\u6587\u5B57\u4E3267',
               hterm.wc.substring(mixedString, 5, 15));
  assert.equal(asciiString.substring(2, 5),
               hterm.wc.substring(asciiString, 2, 5));
  assert.equal(asciiString.substring(0, 0),
               hterm.wc.substring(asciiString, 0, 0));
  assert.equal(asciiString.substring(2, 15),
               hterm.wc.substring(asciiString, 2, 15));
});

});
