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
