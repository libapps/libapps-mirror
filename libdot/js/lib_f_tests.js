// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Utility functions test suite.
 */

lib.f.Tests = new lib.TestManager.Suite('lib.f.Tests');

lib.f.Tests.addTest('replaceVars', function(result, cx) {
  var input;

  input = 'l/i%20b d&ot+';
  result.assertEQ(
    lib.f.replaceVars('blah %encodeURI(name) blah', {name: input}),
    'blah ' + encodeURI(input) + ' blah');

  input = 'l/i%20b d&ot+';
  result.assertEQ(
    lib.f.replaceVars('blah %encodeURIComponent(name) blah', {name: input}),
    'blah ' + encodeURIComponent(input) + ' blah');

  input = '<lib&dot> text';
  result.assertEQ(
    lib.f.replaceVars('blah %escapeHTML(name) blah', {name: input}),
    'blah &lt;lib&amp;dot&gt; text blah');

  result.pass();
});

lib.f.Tests.addTest('parseQuery', function(result, cx) {
  // Can't use assertEQ directly because JS can't compare objects easily.
  var ret = lib.f.parseQuery('var=value&foo=blah&cow=milky');
  result.assertEQ(ret['var'], 'value');
  result.assertEQ(ret['foo'], 'blah');
  result.assertEQ(ret['cow'], 'milky');
  result.pass();
});

lib.f.Tests.addTest('getURL', function(result, cx) {
  if (lib.f.getURL.chromeSupported()) {
    result.assertEQ(lib.f.getURL('foo'), chrome.runtime.getURL(foo));
  } else {
    // We don't have a chrome.runtime and such, so just test pass through.
    result.assertEQ(lib.f.getURL('foo'), 'foo');
  }
  result.pass();
});

lib.f.Tests.addTest('clamp', function(result, cx) {
  result.assertEQ(lib.f.clamp(0, -1, 1), 0);
  result.assertEQ(lib.f.clamp(0, 10, 100), 10);
  result.assertEQ(lib.f.clamp(0, -100, -3), -3);
  result.pass();
});

lib.f.Tests.addTest('zpad', function(result, cx) {
  result.assertEQ(lib.f.zpad(0, 0), '0');
  result.assertEQ(lib.f.zpad(0, 5), '00000');
  result.assertEQ(lib.f.zpad(123, 5), '00123');
  result.pass();
});

lib.f.Tests.addTest('getWhitespace', function(result, cx) {
  // Test growing first.
  result.assertEQ(lib.f.getWhitespace(0), '');
  result.assertEQ(lib.f.getWhitespace(2), '  ');
  result.assertEQ(lib.f.getWhitespace(20), '                    ');

  // Then retest smaller sizes (after internal cache has grown).
  result.assertEQ(lib.f.getWhitespace(0), '');
  result.assertEQ(lib.f.getWhitespace(4), '    ');

  // Edge cases!
  result.assertEQ(lib.f.getWhitespace(-10), '');

  result.pass();
});

lib.f.Tests.addTest('randomInt', function(result, cx) {
  // How many extra samples to grab.  It's random, so hope for the best.
  var maxSamples = 1000;
  var i, ret;
  var seen = [];
  var min = 0;
  var max = 10;

  for (i = 0; i < maxSamples; ++i) {
    ret = lib.f.randomInt(min, max);
    result.assertEQ(true, (ret >= min && ret <= max));
    seen[ret] = 1;
  }

  result.assertEQ((max - min + 1), seen.reduce((sum, value) => sum + value);

  result.pass();
});
