// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.remote.fs.execute.Tests = new lib.TestManager.Suite(
    'wam.remote.fs.execute.Tests');

wam.remote.fs.execute.Tests.prototype.verbose = false;

wam.remote.fs.execute.Tests.prototype.preamble =
    wam.remote.fs.handshake.Tests.prototype.preamble;

wam.remote.fs.execute.Tests.prototype.setupHandshake =
    wam.remote.fs.handshake.Tests.prototype.setupHandshake;

wam.remote.fs.execute.Tests.addTest
('execute', function(result, cx) {
  var expectPath = '/foo';
  var expectArg = {a:1, b:2};
  var expectEnv = {TERM: 'hterm'};
  var expectTTY = {isatty: true, rows: 24, columns: 80, interrupt: '\x03'};
  var expectResult = 'lgtm';

  var didExecute = false;
  var didClose = false;

  this.localFS.onExecuteContextCreated.addListener(function(ex) {
      ex.onExecute.addListener(function() {
          ex.ready();
          result.assertEQ(ex.path, expectPath);
          result.assertEQ(JSON.stringify(ex.arg), JSON.stringify(expectArg));
          result.assertEQ(JSON.stringify(ex.getEnvs()),
                          JSON.stringify(expectEnv));
          result.assertEQ(JSON.stringify(ex.getTTY()),
                          JSON.stringify(expectTTY));
          ex.closeOk(expectResult);
          didExecute = true;
        });
    });

  this.setupHandshake(function() {
      var ex = this.remoteFS.createExecuteContext();
      ex.onClose.addListener(function(reason, value) {
          result.assertEQ(reason, 'ok');
          result.assertEQ(value, expectResult);
          didClose = true;
        });

      ex.setEnvs(expectEnv);
      ex.setTTY(expectTTY);
      ex.execute(expectPath, expectArg);
    }.bind(this));

  setTimeout(function() {
      result.assert(didExecute);
      result.assert(didClose);
      result.pass();
    }, 100);

  result.requestTime(1000);
});
