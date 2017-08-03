// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.wc.Tests = new lib.TestManager.Suite('lib.wc.Tests');

lib.wc.Tests.addTest('strWidth-test', function(result, cx) {
  var asciiOnechar = 'a';
  var asciiString = 'an ascii string';
  var widecharOnechar = '\u4E2D';
  var widecharString = '\u4E2D\u6587\u5B57\u4E32';
  var ambiguousOnechar = '\u2026'; // Horizontal ellipsis
  var mixedString = '\u4E2D\u6587 English';
  var nullChar = '\u0000';
  var controlChar = '\r';
  var musicalSign = '\uD834\uDD00';
  var wideSurrogatePair = '\uD842\uDD9D';
  var combiningChar = 'A\u030A';

  result.assertEQ(1, lib.wc.strWidth(asciiOnechar), 'ASCII char has wcwidth 1');
  result.assertEQ(15, lib.wc.strWidth(asciiString), 'ASCII string');
  result.assertEQ(2, lib.wc.strWidth(widecharOnechar),
                  'Chinese char has width 2');
  result.assertEQ(8, lib.wc.strWidth(widecharString), 'Widechar string');
  result.assertEQ(1, lib.wc.strWidth(ambiguousOnechar),
                  'East Asian Ambiguous character has width 1');
  result.assertEQ(12, lib.wc.strWidth(mixedString), 'Mixed string');
  result.assertEQ(0, lib.wc.strWidth(nullChar), 'Null char has wcwdith 0');
  result.assertEQ(0, lib.wc.strWidth(controlChar),
                  'Control char has width 0');
  result.assertEQ(1, lib.wc.strWidth(musicalSign),
                  'A surrogate pair is considered as a single character.');
  result.assertEQ(2, lib.wc.strWidth(wideSurrogatePair),
                  'A wide character represented in a surrogate pair.');
  result.assertEQ(1, lib.wc.strWidth(combiningChar),
                  'A combining character.');

  result.pass();
});

lib.wc.Tests.addTest('charWidthRegardAmbiguous-test', function(result, cs) {
  var asciiChar = 'a';
  var wideChar = '\u4E2D';
  var ambiguousChar = '\u2026'; // Horizontal ellipsis
  var nullChar = '\u0000';
  var controlChar = '\r';

  result.assertEQ(1, lib.wc.charWidthRegardAmbiguous(asciiChar.charCodeAt(0)),
                  'ASCII char has width 1');
  result.assertEQ(2, lib.wc.charWidthRegardAmbiguous(wideChar.charCodeAt(0)),
                  'Chinese char has width 2');
  result.assertEQ(2,
                  lib.wc.charWidthRegardAmbiguous(ambiguousChar.charCodeAt(0)),
                  'East Asian Ambiguous character has width 2');
  result.assertEQ(0, lib.wc.charWidthRegardAmbiguous(nullChar.charCodeAt(0)),
                  'Null char has wcwdith 0');
  result.assertEQ(0, lib.wc.charWidthRegardAmbiguous(controlChar.charCodeAt(0)),
                  'Control char has width 0');

  result.pass();
});

lib.wc.Tests.addTest('substr-test', function(result, cx) {
  var asciiOnechar = '1';
  var asciiString = '1234567890';
  var widecharOnechar = '\u4E2D';
  var widecharString = '\u4E2D\u6587\u5B57\u4E32\u4E2D\u6587\u5B57\u4E32';
  var mixedString = '12345\u4E2D\u6587\u5B57\u4E3267890';
  var combiningString = '123A\u030A456';

  result.assertEQ('1', lib.wc.substr(asciiOnechar, 0, 1));
  result.assertEQ('1', lib.wc.substr(asciiOnechar, 0, 2));
  result.assertEQ('1', lib.wc.substr(asciiOnechar, 0));
  result.assertEQ('', lib.wc.substr(asciiOnechar, 0, 0));
  result.assertEQ('', lib.wc.substr(asciiOnechar, 1));

  result.assertEQ('1234', lib.wc.substr(asciiString, 0, 4));
  result.assertEQ('1234567890', lib.wc.substr(asciiString, 0, 15));
  result.assertEQ('5678', lib.wc.substr(asciiString, 4, 4));
  result.assertEQ('567890', lib.wc.substr(asciiString, 4, 10));
  result.assertEQ('67890', lib.wc.substr(asciiString, 5));
  result.assertEQ('', lib.wc.substr(asciiString, 0, 0));
  result.assertEQ('', lib.wc.substr(asciiString, 11));

  result.assertEQ('\u4E2D', lib.wc.substr(widecharOnechar, 0, 2));
  result.assertEQ('\u4E2D', lib.wc.substr(widecharOnechar, 0, 3));
  result.assertEQ('\u4E2D', lib.wc.substr(widecharOnechar, 0));
  result.assertEQ('\u4E2D', lib.wc.substr(widecharOnechar, 1));
  result.assertEQ('', lib.wc.substr(widecharOnechar, 0, 0));
  result.assertEQ('', lib.wc.substr(widecharOnechar, 0, 1));
  result.assertEQ('', lib.wc.substr(widecharOnechar, 2));

  result.assertEQ('\u4E2D\u6587', lib.wc.substr(widecharString, 0, 4));
  result.assertEQ('\u4E2D\u6587', lib.wc.substr(widecharString, 0, 5));
  result.assertEQ('\u4E2D\u6587\u5B57\u4E32\u4E2D\u6587\u5B57\u4E32',
                  lib.wc.substr(widecharString, 0, 20));
  result.assertEQ('\u5B57\u4E32', lib.wc.substr(widecharString, 4, 4));
  result.assertEQ('\u5B57\u4E32\u4E2D\u6587\u5B57\u4E32',
                  lib.wc.substr(widecharString, 4, 20));
  result.assertEQ('\u5B57\u4E32\u4E2D\u6587\u5B57\u4E32',
                  lib.wc.substr(widecharString, 5));
  result.assertEQ('', lib.wc.substr(widecharString, 0, 0));
  result.assertEQ('', lib.wc.substr(widecharString, 17));

  result.assertEQ('12345\u4E2D', lib.wc.substr(mixedString, 0, 7));
  result.assertEQ(mixedString, lib.wc.substr(mixedString, 0));
  result.assertEQ(mixedString, lib.wc.substr(mixedString, 0, 20));

  result.assertEQ('123A\u030a456', lib.wc.substr(combiningString, 0, 7));
  result.assertEQ('123A\u030a', lib.wc.substr(combiningString, 0, 4));
  result.assertEQ('123', lib.wc.substr(combiningString, 0, 3));
  result.assertEQ('3A\u030a', lib.wc.substr(combiningString, 2, 2));
  result.assertEQ('A\u030a4', lib.wc.substr(combiningString, 3, 2));
  result.assertEQ('A\u030a', lib.wc.substr(combiningString, 3, 1));

  result.pass();
});

lib.wc.Tests.addTest('substring-test', function(result, cx) {
  var asciiString = '1234567890';
  var widecharString = '\u4E2D\u6587\u5B57\u4E32\u4E2D\u6587\u5B57\u4E32';
  var mixedString = '12345\u4E2D\u6587\u5B57\u4E3267890';

  result.assertEQ('\u6587\u5B57', lib.wc.substring(widecharString, 2, 6));
  result.assertEQ('\u6587\u5B57', lib.wc.substring(widecharString, 3, 7));
  result.assertEQ('\u4E2D\u6587\u5B57\u4E3267',
                  lib.wc.substring(mixedString, 5, 15));
  result.assertEQ(asciiString.substring(2, 5),
                  lib.wc.substring(asciiString, 2, 5));
  result.assertEQ(asciiString.substring(0, 0),
                  lib.wc.substring(asciiString, 0, 0));
  result.assertEQ(asciiString.substring(2, 15),
                  lib.wc.substring(asciiString, 2, 15));

  result.pass();
});
