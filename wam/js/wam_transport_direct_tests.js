// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.transport.Direct.Tests = new lib.TestManager.Suite(
    'wam.transport.Direct.Tests');

wam.transport.Direct.Tests.addTest
('simple', function(result, cx) {
  var ary = wam.transport.Direct.createPair();
  var a = ary[0], b = ary[1];

  var didMessageA = false;
  var expectMessageToA = 'message to a';

  var didMessageB = false;
  var expectMessageToB = 'message to b';

  a.onMessage.addListener(function(value) {
      result.assertEQ(value, expectMessageToA);
      didMessageA = true;
    });

  b.onMessage.addListener(function(value) {
      result.assertEQ(value, expectMessageToB);
      didMessageB = true;
    });

  a.send(expectMessageToB);
  b.send(expectMessageToA);

  wam.setImmediate(function() {
      result.assert(didMessageA);
      result.assert(didMessageB);
      result.pass();
    });

  result.requestTime(1000);
});

wam.transport.Direct.Tests.addTest
('disconnect-a', function(result, cx) {
  var ary = wam.transport.Direct.createPair();
  var a = ary[0], b = ary[1];

  a.disconnect();

  setTimeout(function() {
      result.assertEQ(a.readyBinding.readyState, 'CLOSED');
      result.assertEQ(b.readyBinding.readyState, 'ERROR');
      result.pass();
    }, 0);

  result.requestTime(1000);
});

wam.transport.Direct.Tests.addTest
('disconnect-b', function(result, cx) {
  var ary = wam.transport.Direct.createPair();
  var a = ary[0], b = ary[1];

  b.disconnect();

  setTimeout(function() {
      result.assertEQ(a.readyBinding.readyState, 'ERROR');
      result.assertEQ(b.readyBinding.readyState, 'CLOSED');
      result.pass();
    }, 0);

  result.requestTime(1000);
});
