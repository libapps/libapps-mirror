// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.jsfs.Tests = new lib.TestManager.Suite(
    'wam.jsfs.Tests');

wam.jsfs.Tests.prototype.verbose = false;

wam.jsfs.Tests.prototype.preamble = function() {
  wam.remote.fs.handshake.Tests.prototype.preamble.apply(this);
  this.jsfs = new wam.jsfs.FileSystem();
  this.jsfs.addBinding(this.localFS);
};

wam.jsfs.Tests.prototype.setupHandshake =
    wam.remote.fs.handshake.Tests.prototype.setupHandshake;

wam.jsfs.Tests.addTest
('execute', function(result, cx) {
  var expectArg = {foo:1, bar:2};

  var executeCallback = function(executeContext) {
    executeContext.ready();
    result.assertEQ(JSON.stringify(executeContext.arg),
                    JSON.stringify(expectArg));
    executeContext.closeOk(null);
  };

  var onHandshake = function() {
    result.assert(this.remoteFS.isReadyState('READY'));

    var ec = this.remoteFS.createExecuteContext();
    ec.onClose.addListener(function(reason, value) {
        result.assertEQ(reason, 'ok', JSON.stringify(value));
        wam.async(result.pass, [result]);
      });

    ec.execute('/exe/test', expectArg);
  }.bind(this);

  this.jsfs.makeEntries(
      '/exe/', {test: new wam.jsfs.Executable(executeCallback)},
      this.setupHandshake.bind(this, onHandshake),
      function(value) { result.fail(JSON.stringify(value)) });

  result.requestTime(1000);
});
