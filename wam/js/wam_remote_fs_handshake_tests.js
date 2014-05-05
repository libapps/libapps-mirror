// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.remote.fs.handshake.Tests = new lib.TestManager.Suite(
    'wam.remote.fs.handshake.Tests');

wam.remote.fs.handshake.Tests.prototype.verbose = false;

/**
 * Run before each test to reset the state.
 */
wam.remote.fs.handshake.Tests.prototype.preamble = function(cx) {
  this.transports = wam.transport.Direct.createPair();
  this.channelA = new wam.Channel(this.transports[0], 'A-to-B');
  this.channelB = new wam.Channel(this.transports[1], 'B-to-A');

  if (this.verbose) {
    this.channelA.verbose =
        this.channelB.verbose = (wam.Channel.verbosity.OUT |
                                 wam.Channel.verbosity.SYNTHETIC);
  }

  this.localFS = new wam.binding.fs.FileSystem();
  this.localFS.ready();

  this.remoteFS = null;
};

wam.remote.fs.handshake.Tests.prototype.setupHandshake = function(callback) {
  this.channelB.onHandshakeOffered.addListener(function(offerEvent) {
      if (!wam.remote.fs.testOffer(offerEvent.inMessage))
        return;

      this.handshakeResponse = new wam.remote.fs.handshake.Response(
          offerEvent.inMessage, this.localFS);

      this.handshakeResponse.sendReady();
      offerEvent.response = this.handshakeResponse;
    }.bind(this));

  this.handshakeRequest = new wam.remote.fs.handshake.Request(this.channelA);
  this.remoteFS = this.handshakeRequest.fileSystem;
  this.remoteFS.onReady.addListener(callback);
  this.handshakeRequest.sendRequest();
};

wam.remote.fs.handshake.Tests.addTest
('handshake-accept', function(result, cx) {
  this.setupHandshake(function() {
      result.assert(this.remoteFS.isReadyState('READY'));
      result.assert(this.handshakeResponse.readyBinding.isReadyState('READY'));
      wam.async(result.pass, [result]);
    }.bind(this));

  result.requestTime(1000);
});

wam.remote.fs.handshake.Tests.addTest
('stat', function(result, cx) {
  var expectPath = '/foo';
  var expectResult = {a:1, b:2};

  this.localFS.onStat.addListener(function (arg, onSuccess, onError) {
      result.assertEQ(arg.path, expectPath);
      wam.async(onSuccess, [null, expectResult]);
    });

  this.setupHandshake(function() {
      this.remoteFS.stat
          ({path: expectPath},
           function(statResult) {
             result.assertEQ(JSON.stringify(statResult),
                             JSON.stringify(expectResult));
             wam.async(result.pass, [result]);
           },
           function() {
             result.fail('stat failed');
           });
    }.bind(this));

  result.requestTime(1000);
});

wam.remote.fs.handshake.Tests.addTest
('stat-fail', function(result, cx) {
  var expectPath = '/foo';
  var expectError = 'wam.FileSystem.Error.NotFound';

  this.localFS.onStat.addListener(function (arg, onSuccess, onError) {
      result.assertEQ(arg.path, expectPath);
      onError(wam.mkerr(expectError, [expectPath]));
    });

  this.setupHandshake(function() {
      this.remoteFS.stat
          ({path: expectPath},
           function(statResult) {
             result.fail('stat should have failed');
           },
           function(value) {
             result.assertEQ(value.errorName, expectError);
             result.assertEQ(value.errorArg.path, expectPath);
             wam.async(result.pass, [result]);
           });
    }.bind(this));

  result.requestTime(1000);
});

wam.remote.fs.handshake.Tests.addTest
('list', function(result, cx) {
  var expectPath = '/foo';
  var expectResult = {a:1, b:2};

  this.localFS.onList.addListener(function (arg, onSuccess, onError) {
      result.assertEQ(arg.path, expectPath);
      wam.async(onSuccess, [null, expectResult]);
    });

  this.setupHandshake(function() {
      this.remoteFS.list
          ({path: expectPath},
           function(listResult) {
             result.assertEQ(JSON.stringify(listResult),
                             JSON.stringify(expectResult));
             wam.async(result.pass, [result]);
           },
           function() {
             result.fail('list failed');
           });
    }.bind(this));

  result.requestTime(1000);
});

wam.remote.fs.handshake.Tests.addTest
('list-fail', function(result, cx) {
  var expectPath = '/foo';
  var expectError = 'wam.FileSystem.Error.NotFound';

  var didList = false;

  this.localFS.onList.addListener(function (arg, onSuccess, onError) {
      result.assertEQ(arg.path, expectPath);
      onError(wam.mkerr(expectError, [expectPath]));
    });

  this.setupHandshake(function() {
      this.remoteFS.list
          ({path: expectPath},
           function(statResult) {
             result.fail('list should have failed');
           },
           function(value) {
             result.assertEQ(value.errorName, expectError);
             result.assertEQ(value.errorArg.path, expectPath);
             didList = true;
           });
    }.bind(this));

  setTimeout(function() {
      result.assert(didList);
      result.pass();
    }, 100);


  result.requestTime(1000);
});
