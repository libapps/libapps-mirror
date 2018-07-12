// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview i18n functions test suite.
 */

lib.i18n.Tests = new lib.TestManager.Suite('lib.i18n.Tests');

/**
 * Basic sanity test.  Hard to validate real values here.
 */
lib.i18n.Tests.addTest('getAcceptLanguages', function(result, cx) {
  // Just make sure we're called with an array of some sort.
  lib.i18n.getAcceptLanguages((langs) => {
    result.assert(langs instanceof Array);
    result.pass();
  });

  result.requestTime(1000);
});

/**
 * Basic sanity test.  Hard to validate real values here.
 */
lib.i18n.Tests.addTest('getMessage', function(result, cx) {
  // There shouldn't be any registered messages.
  result.assertEQ('', lib.i18n.getMessage('ID'));

  // Check fallback message.
  result.assertEQ('yes', lib.i18n.getMessage('ID', null, 'yes'));

  result.pass();
});

/**
 * Check replacements happen as expected.
 *
 * We don't bother checking lib.i18n.getMessage.
 */
lib.i18n.Tests.addTest('replaceReferences', function(result, cx) {
  // Empty substitutions.
  result.assertEQ('foba', lib.i18n.replaceReferences('fo$1ba', null));
  result.assertEQ('foba', lib.i18n.replaceReferences('fo$1ba', undefined));
  result.assertEQ('foba', lib.i18n.replaceReferences('fo$1ba', []));

  // Too few substitutions.
  result.assertEQ('foXbar', lib.i18n.replaceReferences('fo$1ba$2r', ['X']));

  result.pass();
});
