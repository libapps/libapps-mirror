// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview UTF8 test suite.
 *
 * This tests the handling of UTF-8 encoded strings. By "UTF-8 encoded string"
 * it is meant a normal JS string where only the code points U+0000 through
 * U+00FF are used, and reprsent the byte values used in the UTF-8 encoding of
 * a Unicode string. For charcaters in the ASCII range, this is an identity
 * encoding. For all others, this results in a series of Latin-1 characters
 * (U+0080 through U+00FF) for each.
 */

lib.UTF8 = {};
lib.UTF8.Tests = new lib.TestManager.Suite('lib.UTF8.Tests');

lib.UTF8.Tests.addTest('round-trip-ASCII', function(result, cx) {
  var roundTripASCII = function(str) {
    var enc = lib.encodeUTF8(str);
    var dec = lib.decodeUTF8(enc);

    result.assertEQ(enc, str, "ASCII encodes to itself");
    result.assertEQ(dec, str, "ASCII decodes to itself");
  };

  roundTripASCII('');
  roundTripASCII('a');
  roundTripASCII('abc');
  result.pass();
});

lib.UTF8.Tests.addTest('round-trip-multibyte', function(result, cx) {
  var roundTripMultibyte = function(str) {
    var enc = lib.encodeUTF8(str);
    var dec = lib.decodeUTF8(enc);

    result.assert(enc.length > str.length, "Multibyte encodes to longer");
    result.assertEQ(dec, str, "Multibyte round trips to self");
  };

  roundTripMultibyte('áבç');
  roundTripMultibyte('一丁丂');
  roundTripMultibyte('𝄞𝄢');
  result.pass();
});

lib.UTF8.Tests.addTest('chunked-decoding', function(result, cx) {
  var str = "abγδ∀∃𝄞𝄢";
  var enc = lib.encodeUTF8(str);

  for (var i = 0; i <= enc.length; i += 1) {
    var encPart1 = enc.substring(0,i);
    var encPart2 = enc.substring(i);

    var decoder = new lib.UTF8Decoder();
    var decPart1 = decoder.decode(encPart1);
    var decPart2 = decoder.decode(encPart2);
    var dec = decPart1 + decPart2;

    result.assertEQ(dec, str, "Round trips when split at " + i);
  }
  result.pass();
});

lib.UTF8.Tests.addTest('decoding-bad-sequences', function(result, cx) {
  var encPart1 = lib.encodeUTF8('abc');
  var encPart3 = lib.encodeUTF8('def');
  var str = "abc\ufffddef";

  var testBad = function(badUTF8, type) {
    var enc = encPart1 + badUTF8 + encPart3;
    var dec = lib.decodeUTF8(enc);

    result.assertEQ(dec, str, "Decoding with " + type);
  };

  testBad('\u0080', 'bare continuation');
  testBad('\u00C2', 'two byte starter');
  testBad('\u00E2', 'three byte starter');
  testBad('\u00E2\u0080', 'two of three byte sequence');
  testBad('\u00F0', 'four byte starter');
  testBad('\u00F0\u0080', 'two of four byte sequence');
  testBad('\u00F0\u0080\u0080', 'three of four byte sequence');
  testBad('\u00C0', 'illegal starter');
  testBad('\u00C0\u0080', 'illegal two byte');
  testBad('\u00E0\u0080\u0080', 'illegal three byte');
  result.pass();
});

lib.UTF8.Tests.addTest('round-trip-blocks', function(result, cx) {
  var codepointString = function(n) {
    var h = n.toString(16).toUpperCase();
    return 'U+' + '0000'.substring(0, 4 - h.length) + h;
  };

  var blockRoundTrip = function(blockStart, blockSize) {
    var blockEnd = blockStart + blockSize - 1;
    var cp;
    var str = '';
    for (cp = blockStart; cp <= blockEnd; cp += 1) {
      if (cp < 0xd800 || 0xdfff < cp) {
        if (cp <= 0xffff) {
          str += String.fromCharCode(cp);
        } else {
          var high = ((cp - 0x10000) >> 10) | 0xD800;
          var low  = (cp & 0x03FF)          | 0xDC00;
          str += String.fromCharCode(high) + String.fromCharCode(low);
        }
      }
    };

    var enc = lib.encodeUTF8(str);
    var dec = lib.decodeUTF8(enc);

    result.assertEQ(dec, str,
      'Block ' + codepointString(blockStart)
      + ' ~ ' + codepointString(blockEnd));
  }

  var testBlockRange = function(blockLow, blockHigh, blockSize) {
    var block;
    for (block = blockLow; block <= blockHigh; block += blockSize) {
      if (block + blockSize - 1 < 0xD800 || 0xDFFF < block) {
        blockRoundTrip(block, blockSize);
      }
    }
  };

  testBlockRange(0x0000, 0xFFFF, 64);       // test BMP in small blocks
  testBlockRange(0x10000, 0x10FFFF, 4096);  // rest in large
  result.pass();
});

