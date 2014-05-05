// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.binding.Ready.Tests = new lib.TestManager.Suite(
    'wam.binding.Ready.Tests');

wam.binding.Ready.Tests.addTest('simple', function(result, cx) {
    var ready = new wam.binding.Ready();

    result.assert(ready.isReadyState('WAIT'));
    result.assertEQ(ready.isOpen, false);

    ready.ready('ready value');
    result.assert(ready.isReadyState('READY'));
    result.assertEQ(ready.isOpen, true);
    result.assertEQ(ready.readyValue, 'ready value');

    ready.closeOk('close value');
    result.assert(ready.isReadyState('CLOSED'));
    result.assertEQ(ready.isOpen, false);
    result.assertEQ(ready.closeReason, 'ok');
    result.assertEQ(ready.closeValue, 'close value');

    result.pass();
  });

wam.binding.Ready.Tests.addTest('events', function(result, cx) {
    var ready = new wam.binding.Ready();
    var readyValue = null;
    var closeReason = null;
    var closeValue = null;

    ready.onReady.addListener(function(value) { readyValue = value; });
    ready.onClose.addListener(function(reason, value) {
        closeReason = reason;
        closeValue = value;
      });

    ready.ready('ready value');
    result.assertEQ(readyValue, 'ready value');

    ready.closeOk('close value');
    result.assertEQ(closeReason, 'ok');
    result.assertEQ(closeValue, 'close value');

    result.pass();
});

wam.binding.Ready.Tests.addTest('dependsOn-ok', function(result, cx) {
    var a = new wam.binding.Ready();
    var b = new wam.binding.Ready();

    var didCloseA = false;
    var didCloseB = false;
    var expectCloseValue = 'close value';

    a.onClose.addListener(function(reason, value) {
        result.assertEQ(reason, 'ok');
        result.assertEQ(value, expectCloseValue);
        didCloseA = true;
      });

    b.onClose.addListener(function(reason, value) {
        result.assertEQ(reason, 'error');
        result.assertEQ(value.errorName, 'wam.Error.ParentClosed');
        result.assertEQ(value.errorArg.name, 'ok');
        result.assertEQ(value.errorArg.arg, expectCloseValue);
        didCloseB = true;
     });

    a.ready();
    b.dependsOn(a);
    b.ready();
    a.closeOk('close value');

    result.assert(didCloseA);
    result.assert(didCloseB);

    result.pass();
  });

wam.binding.Ready.Tests.addTest('dependsOn-error', function(result, cx) {
    var a = new wam.binding.Ready();
    var b = new wam.binding.Ready();

    var didCloseA = false;
    var didCloseB = false;
    var expectCloseValue = 'close value';

    a.onClose.addListener(function(reason, value) {
        result.assertEQ(reason, 'error');
        result.assertEQ(value, expectCloseValue);
        didCloseA = true;
      });

    b.onClose.addListener(function(reason, value) {
        result.assertEQ(reason, 'error');
        result.assertEQ(value.errorName, 'wam.Error.ParentClosed');
        result.assertEQ(value.errorArg.name, 'error');
        result.assertEQ(value.errorArg.arg, expectCloseValue);
        didCloseB = true;
     });

    a.ready();
    b.dependsOn(a);
    b.ready();
    a.closeErrorValue('close value');

    result.assert(didCloseA);
    result.assert(didCloseB);

    result.pass();
  });

wam.binding.Ready.Tests.addTest('double-ready', function(result, cx) {
    var ready = new wam.binding.Ready();
    var didThrow = false;

    ready.ready();
    try {
      ready.ready();
    } catch (ex) {
      didThrow = true;
    }

    result.assert(didThrow);
    result.pass();
  });

wam.binding.Ready.Tests.addTest('double-close', function(result, cx) {
    var ready = new wam.binding.Ready();
    var didThrow = false;

    ready.ready();
    ready.closeOk(null);

    try {
      ready.closeErrorValue(null);
    } catch (ex) {
      didThrow = true;
    }

    result.assert(didThrow);
    result.pass();
  });

wam.binding.Ready.Tests.addTest('bad-state', function(result, cx) {
    var ready = new wam.binding.Ready();
    var didThrow = false;

    try {
      ready.isReadyState('bogus');
    } catch (ex) {
      didThrow = true;
    }

    result.assert(didThrow);
    result.pass();
  });
