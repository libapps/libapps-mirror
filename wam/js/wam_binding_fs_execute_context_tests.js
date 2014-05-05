// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.binding.fs.ExecuteContext.Tests = new lib.TestManager.Suite(
    'wam.binding.ExecuteContext.Tests');

wam.binding.fs.ExecuteContext.Tests.addTest
('execute', function(result, cx) {
  var fs = new wam.binding.fs.FileSystem();
  fs.ready();

  var ex = fs.createExecuteContext();

  var didExe = false;
  var didClose = false;

  var expectClose = 'close value';
  var expectPath = '/foo/bar';
  var expectArg = '[1,2,3]';
  var expectEnv = '{"TERM":"xterm"}';
  var expectTTY = {isatty: true, rows: 24, columns: 80, interrupt: '\x03'};

  ex.onExecute.addListener(function() {
      result.assertEQ(ex.path, expectPath);
      result.assertEQ(JSON.stringify(ex.arg), expectArg);
      result.assertEQ(JSON.stringify(ex.getEnvs()), expectEnv);
      result.assertEQ(JSON.stringify(ex.getTTY()), JSON.stringify(expectTTY));
      didExe = true;
    });

  ex.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'ok');
      result.assertEQ(value, expectClose);
      didClose = true;
    });

  ex.setEnvs(JSON.parse(expectEnv));
  ex.setTTY(expectTTY);
  ex.execute(expectPath, JSON.parse(expectArg));
  result.assert(didExe);

  ex.ready();
  ex.closeOk(expectClose);
  result.assert(didClose);

  result.pass();
});

wam.binding.fs.ExecuteContext.Tests.addTest
('double-execute', function(result, cx) {
  var fs = new wam.binding.fs.FileSystem();
  fs.ready();

  var ex = fs.createExecuteContext();
  ex.execute('foo', null);

  var didThrow = false;

  try {
    ex.execute('bar', null);
  } catch (err) {
    didThrow = true;
  }

  result.assert(didThrow);
  result.pass();
});

wam.binding.fs.ExecuteContext.Tests.addTest
('depends-on', function(result, cx) {
  var fs = new wam.binding.fs.FileSystem();
  fs.ready(null);
  fs.assertReady();

  var ex = fs.createExecuteContext();
  fs.closeOk(null);

  var didThrow = false;

  try {
    ex.execute('bar', null);
  } catch (err) {
    didThrow = true;
  }

  result.assert(didThrow);
  result.pass();
});
