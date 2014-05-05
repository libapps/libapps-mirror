// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.binding.fs.FileSystem.Tests = new lib.TestManager.Suite(
    'wam.binding.FileSystem.Tests');

wam.binding.fs.FileSystem.Tests.addTest
('ready-close', function(result, cx) {
  var fs = new wam.binding.fs.FileSystem();

  var didReady = false;
  var expectReady = 'ready value';
  var didClose = false;
  var expectClose = 'close value';

  fs.onReady.addListener(function(value) {
      result.assertEQ(value, expectReady);
      didReady = true;
    });

  fs.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'ok');
      result.assertEQ(value, expectClose);
      didClose = true;
    });

  fs.ready(expectReady);
  result.assert(didReady);

  fs.closeOk(expectClose);
  result.assert(didClose);

  result.pass();
});

wam.binding.fs.FileSystem.Tests.addTest
('stat', function(result, cx) {
  var fs = new wam.binding.fs.FileSystem();

  fs.onStat.addListener(function(arg, onSuccess, onError) {
      result.assertEQ(arg.path, '/foo');
      onSuccess({'foo': 1});
    });

  fs.ready();
  fs.stat({path: '/foo'},
          function(stat) {
            result.assertEQ(JSON.stringify(stat), '{"foo":1}');
            result.pass();
          },
          function() { result.fail() });
});

wam.binding.fs.FileSystem.Tests.addTest
('list', function(result, cx) {
  var fs = new wam.binding.fs.FileSystem();

  var sendList = {'foo': 1};
  fs.onList.addListener(function(arg, onSuccess, onError) {
      result.assertEQ(arg.path, '/foo');
      onSuccess(sendList);
    });

  fs.ready();
  fs.list({path: '/foo'},
          function(list) {
            result.assertEQ(JSON.stringify(list), JSON.stringify(sendList));
            result.pass();
          },
          function() { result.fail() });
});

wam.binding.fs.FileSystem.Tests.addTest
('execute-context', function(result, cx) {
  var fs = new wam.binding.fs.FileSystem();
  var didEC = false;

  fs.onExecuteContextCreated.addListener(function(ec) {
      result.assert(ec instanceof wam.binding.fs.ExecuteContext);
      didEC = true;
    });

  fs.ready();
  var ec = fs.createExecuteContext();
  result.assert(didEC);
  result.assert(ec instanceof wam.binding.fs.ExecuteContext);
  result.pass();
});
