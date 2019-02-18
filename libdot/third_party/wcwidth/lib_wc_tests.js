// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

describe('lib_wc_tests.js', () => {

it('strWidth-test', () => {
  var asciiOnechar = 'a';
  var asciiString = 'an ascii string';
  var widecharOnechar = '\u4E2D';
  var widecharString = '\u4E2D\u6587\u5B57\u4E32';
  var ambiguousOnechar = '\u2026'; // Horizontal ellipsis
  var mixedString = '\u4E2D\u6587 English';
  var nullChar = '\u0000';
  var controlChar = '\r';
  var musicalSign = '\uD834\uDD00';
  var wideSurrogatePair = '\uD842\uDD9D';  // U+2099d 𠦝
  var narrowSurrogatePair = '\uD83D\uDE6B';  // U+1f66b 🙫
  var combiningChar = 'A\u030A';

  assert.equal(1, lib.wc.strWidth(asciiOnechar), 'ASCII char has wcwidth 1');
  assert.equal(15, lib.wc.strWidth(asciiString), 'ASCII string');
  assert.equal(2, lib.wc.strWidth(widecharOnechar), 'Chinese char has width 2');
  assert.equal(8, lib.wc.strWidth(widecharString), 'Widechar string');
  assert.equal(1, lib.wc.strWidth(ambiguousOnechar),
               'East Asian Ambiguous character has width 1');
  assert.equal(12, lib.wc.strWidth(mixedString), 'Mixed string');
  assert.equal(0, lib.wc.strWidth(nullChar), 'Null char has wcwdith 0');
  assert.equal(0, lib.wc.strWidth(controlChar), 'Control char has width 0');
  assert.equal(1, lib.wc.strWidth(musicalSign),
               'Surrogate pair is considered a single character');
  assert.equal(2, lib.wc.strWidth(wideSurrogatePair),
               'Wide character represented in a surrogate pair');
  assert.equal(1, lib.wc.strWidth(narrowSurrogatePair),
               'Narrow character represented in a surrogate pair');
  assert.equal(1, lib.wc.strWidth(combiningChar), 'A combining character');
});

/**
 * Verify behavior for all codepoints below 0xa0.  It's quick & easy to do so,
 * and this func has optimizations for them specifically.
 */
it('charWidthDisregardAmbiguous-low', () => {
  var i;

  for (i = 0; i < 0x20; ++i)
    assert.equal(0, lib.wc.charWidthDisregardAmbiguous(i));

  for (i = 0x20; i < 0x7f; ++i)
    assert.equal(1, lib.wc.charWidthDisregardAmbiguous(i));

  for (i = 0x7f; i < 0xa0; ++i)
    assert.equal(0, lib.wc.charWidthDisregardAmbiguous(i));
});

it('charWidthRegardAmbiguous-test', () => {
  var asciiChar = 'a';
  var wideChar = '\u4E2D';
  var ambiguousChar = '\u2026'; // Horizontal ellipsis
  var nullChar = '\u0000';
  var controlChar = '\r';

  assert.equal(1, lib.wc.charWidthRegardAmbiguous(asciiChar.charCodeAt(0)),
               'ASCII char has width 1');
  assert.equal(2, lib.wc.charWidthRegardAmbiguous(wideChar.charCodeAt(0)),
               'Chinese char has width 2');
  assert.equal(2, lib.wc.charWidthRegardAmbiguous(ambiguousChar.charCodeAt(0)),
               'East Asian Ambiguous character has width 2');
  assert.equal(0, lib.wc.charWidthRegardAmbiguous(nullChar.charCodeAt(0)),
               'Null char has wcwdith 0');
  assert.equal(0, lib.wc.charWidthRegardAmbiguous(controlChar.charCodeAt(0)),
               'Control char has width 0');
});

it('substr-test', () => {
  var asciiOnechar = '1';
  var asciiString = '1234567890';
  var widecharOnechar = '\u4E2D';
  var widecharString = '\u4E2D\u6587\u5B57\u4E32\u4E2D\u6587\u5B57\u4E32';
  var mixedString = '12345\u4E2D\u6587\u5B57\u4E3267890';
  var combiningString = '123A\u030A456';
  var leadingCombiningString = '\u{30a}x';

  assert.equal('1', lib.wc.substr(asciiOnechar, 0, 1));
  assert.equal('1', lib.wc.substr(asciiOnechar, 0, 2));
  assert.equal('1', lib.wc.substr(asciiOnechar, 0));
  assert.equal('', lib.wc.substr(asciiOnechar, 0, 0));
  assert.equal('', lib.wc.substr(asciiOnechar, 1));

  assert.equal('1234', lib.wc.substr(asciiString, 0, 4));
  assert.equal('1234567890', lib.wc.substr(asciiString, 0, 15));
  assert.equal('5678', lib.wc.substr(asciiString, 4, 4));
  assert.equal('567890', lib.wc.substr(asciiString, 4, 10));
  assert.equal('67890', lib.wc.substr(asciiString, 5));
  assert.equal('', lib.wc.substr(asciiString, 0, 0));
  assert.equal('', lib.wc.substr(asciiString, 11));

  assert.equal('\u4E2D', lib.wc.substr(widecharOnechar, 0, 2));
  assert.equal('\u4E2D', lib.wc.substr(widecharOnechar, 0, 3));
  assert.equal('\u4E2D', lib.wc.substr(widecharOnechar, 0));
  assert.equal('\u4E2D', lib.wc.substr(widecharOnechar, 1));
  assert.equal('', lib.wc.substr(widecharOnechar, 0, 0));
  assert.equal('', lib.wc.substr(widecharOnechar, 0, 1));
  assert.equal('', lib.wc.substr(widecharOnechar, 2));

  assert.equal('\u4E2D\u6587', lib.wc.substr(widecharString, 0, 4));
  assert.equal('\u4E2D\u6587', lib.wc.substr(widecharString, 0, 5));
  assert.equal('\u4E2D\u6587\u5B57\u4E32\u4E2D\u6587\u5B57\u4E32',
               lib.wc.substr(widecharString, 0, 20));
  assert.equal('\u5B57\u4E32', lib.wc.substr(widecharString, 4, 4));
  assert.equal('\u5B57\u4E32\u4E2D\u6587\u5B57\u4E32',
               lib.wc.substr(widecharString, 4, 20));
  assert.equal('\u5B57\u4E32\u4E2D\u6587\u5B57\u4E32',
               lib.wc.substr(widecharString, 5));
  assert.equal('', lib.wc.substr(widecharString, 0, 0));
  assert.equal('', lib.wc.substr(widecharString, 17));

  assert.equal('12345\u4E2D', lib.wc.substr(mixedString, 0, 7));
  assert.equal(mixedString, lib.wc.substr(mixedString, 0));
  assert.equal(mixedString, lib.wc.substr(mixedString, 0, 20));

  assert.equal('123A\u030a456', lib.wc.substr(combiningString, 0, 7));
  assert.equal('123A\u030a', lib.wc.substr(combiningString, 0, 4));
  assert.equal('123', lib.wc.substr(combiningString, 0, 3));
  assert.equal('3A\u030a', lib.wc.substr(combiningString, 2, 2));
  assert.equal('A\u030a4', lib.wc.substr(combiningString, 3, 2));
  assert.equal('A\u030a', lib.wc.substr(combiningString, 3, 1));

  assert.equal(leadingCombiningString,
               lib.wc.substr(leadingCombiningString, 0));
});

it('substr-wide-surrogate-test', () => {
  const string = '12\u{2099d}34';

  // Sanity check this string actually contains a surrogate pair.
  assert.equal(6, string.length);

  assert.equal(string, lib.wc.substr(string, 0));
  assert.equal('12', lib.wc.substr(string, 0, 2));
  assert.equal('2', lib.wc.substr(string, 1, 2));
  assert.equal('2\u{D842}\u{DD9D}', lib.wc.substr(string, 1, 3));
  assert.equal('2\u{D842}\u{DD9D}3', lib.wc.substr(string, 1, 4));
  assert.equal('', lib.wc.substr(string, 2, 1));
  assert.equal('\u{D842}\u{DD9D}', lib.wc.substr(string, 2, 2));
  assert.equal('\u{D842}\u{DD9D}3', lib.wc.substr(string, 2, 3));
  // We don't test column 3 here as it's unclear what the right answer is.
  // That'll be in the middle of the wide character (column wise).
  assert.equal('3', lib.wc.substr(string, 4, 1));
  assert.equal('34', lib.wc.substr(string, 4));
});

it('substr-narrow-surrogate-test', () => {
  const string = '12\u{1f66b}34';

  // Sanity check this string actually contains a surrogate pair.
  assert.equal(6, string.length);

  assert.equal(string, lib.wc.substr(string, 0));
  assert.equal('12', lib.wc.substr(string, 0, 2));
  assert.equal('2\u{1f66b}', lib.wc.substr(string, 1, 2));
  assert.equal('2\u{1f66b}3', lib.wc.substr(string, 1, 3));
  assert.equal('\u{1f66b}', lib.wc.substr(string, 2, 1));
  assert.equal('\u{1f66b}3', lib.wc.substr(string, 2, 2));
  assert.equal('3', lib.wc.substr(string, 3, 1));
  assert.equal('34', lib.wc.substr(string, 3));
});

it('substring-test', () => {
  var asciiString = '1234567890';
  var widecharString = '\u4E2D\u6587\u5B57\u4E32\u4E2D\u6587\u5B57\u4E32';
  var mixedString = '12345\u4E2D\u6587\u5B57\u4E3267890';

  assert.equal('\u6587\u5B57',
               lib.wc.substring(widecharString, 2, 6));
  assert.equal('\u6587\u5B57',
               lib.wc.substring(widecharString, 3, 7));
  assert.equal('\u4E2D\u6587\u5B57\u4E3267',
               lib.wc.substring(mixedString, 5, 15));
  assert.equal(asciiString.substring(2, 5),
               lib.wc.substring(asciiString, 2, 5));
  assert.equal(asciiString.substring(0, 0),
               lib.wc.substring(asciiString, 0, 0));
  assert.equal(asciiString.substring(2, 15),
               lib.wc.substring(asciiString, 2, 15));
});

});
