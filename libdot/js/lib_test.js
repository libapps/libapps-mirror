// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

var testManager;
var testRun;

window.onload = function() {
  lib.init(function() {
    testManager = new lib.TestManager();
    testManager.log.save = true;

    testManager.onTestRunComplete = (testRun) => {
      var status = document.querySelector('#status');
      var passed = document.querySelector('#passed');
      var failed = document.querySelector('#failed');

      status.innerText = 'Finished.';
      status.className = (testRun.failures.length == 0) ? 'good' : 'bad';

      passed.innerText = testRun.passes.length + ' tests passed.';

      if (testRun.failures.length != 0) {
        failed.innerText = 'ERROR: ' + testRun.failures.length + ' tests failed!';
        document.title = failed.innerText;
      } else
        document.title = passed.innerText;

      document.querySelector('#log').innerText = testRun.testManager.log.data;
    };

    testManager.testPreamble = (result, cx) => {
      var testRun = result.testRun;
      cx.window.document.title =
          '[' + (testRun.passes.length + testRun.failures.length) + '] ' +
          result.test.fullName;
    };

    testRun = testManager.createTestRun({window: window});

    // Stop after the first failure to make it easier to debug in the
    // JS console.
    testRun.maxFailures = 1;

    const params = new URLSearchParams(document.location.search);
    const pattern = params.get('pattern');
    testRun.selectPattern(new RegExp(pattern ? pattern : '.'));
    testRun.run();

  }, console.log.bind(console));
};
