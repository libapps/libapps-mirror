// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Google relay tests.
 */

nassh.GoogleRelay.Tests = new lib.TestManager.Suite('nassh.GoogleRelay.Tests');

/**
 * Verify parsing of command lines.
 */
nassh.GoogleRelay.Tests.addTest('parseOptionString', function(result, cx) {
  let rv;

  // Check all the valid options.
  nassh.GoogleRelay.parseOptionString.validOptions_.forEach((opt) => {
    opt = `--${opt}`;
    rv = nassh.GoogleRelay.parseOptionString(opt);
    result.assertEQ('object', typeof rv);
    result.assertEQ(true, rv[opt]);
  });

  // Check the meaning of the options.
  rv = nassh.GoogleRelay.parseOptionString(
      // Check plain options.
      '--report-ack-latency ' +
      // Check options w/values.
      '--config=google ' +
      // Check off options.
      '--no-use-xhr '
  );
  result.assertEQ('object', typeof rv);
  result.assertEQ(true, rv['--report-ack-latency']);
  result.assertEQ('google', rv['--config']);
  result.assertEQ(false, rv['--use-xhr']);

  result.pass();
});
