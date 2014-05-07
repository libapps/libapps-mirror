// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.Channel.Tests = new lib.TestManager.Suite('wam.Channel.Tests');

wam.Channel.Tests.prototype.verbose = false;

/**
 * Run before each test to reset the state.
 */
wam.Channel.Tests.prototype.preamble = function(cx) {
  this.transports = wam.transport.Direct.createPair();
  this.channelA = new wam.Channel(this.transports[0], 'A-to-B');
  this.channelB = new wam.Channel(this.transports[1], 'B-to-A');

  if (this.verbose) {
    this.channelA.verbose =
        this.channelB.verbose = (wam.Channel.verbosity.OUT |
                                 wam.Channel.verbosity.SYNTHETIC);
  }
};

wam.Channel.Tests.addTest
('disconnect-a', function(result, cx) {
  var expectDiagnostic = 'disco sucks';
  var didCloseTransport0 = false;
  var didCloseTransport1 = false;
  var didCloseChannelA = false;
  var didCloseChannelB = false;

  this.transports[0].readyBinding.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'ok');
      result.assertEQ(value, null);
      didCloseTransport0 = true;
    });

  this.transports[1].readyBinding.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'ok');
      result.assertEQ(value, null);
      didCloseTransport1 = true;
    });

  this.channelA.readyBinding.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'ok');
      result.assertEQ(value, null);
      didCloseChannelA = true;
    });

  this.channelB.readyBinding.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'error');
      result.assertEQ(value.errorName, 'wam.Error.ChannelDisconnect');
      result.assertEQ(value.errorArg.diagnostic, expectDiagnostic);
      didCloseChannelB = true;
    });

  this.channelA.disconnect(expectDiagnostic);

  // The direct transport issues close events with a setTimeout(..., 0)
  setTimeout(function() {
      result.assert(didCloseChannelA);
      result.assert(didCloseChannelB);
      result.assert(!didCloseTransport0);
      result.assert(!didCloseTransport1);
      result.pass();
    }, 10);

  result.requestTime(1000);
});

wam.Channel.Tests.addTest
('disconnect-b', function(result, cx) {
  var expectDiagnostic = 'disco sucks';
  var didCloseTransport0 = false;
  var didCloseTransport1 = false;
  var didCloseChannelA = false;
  var didCloseChannelB = false;

  this.transports[0].readyBinding.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'ok');
      result.assertEQ(value, null);
      didCloseTransport0 = true;
    });

  this.transports[1].readyBinding.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'ok');
      result.assertEQ(value, null);
      didCloseTransport1 = true;
    });

  this.channelB.readyBinding.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'ok');
      result.assertEQ(value, null);
      didCloseChannelB = true;
    });

  this.channelA.readyBinding.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'error');
      result.assertEQ(value.errorName, 'wam.Error.ChannelDisconnect');
      result.assertEQ(value.errorArg.diagnostic, expectDiagnostic);
      didCloseChannelA = true;
    });

  this.channelB.disconnect(expectDiagnostic);

  // The direct transport issues close events with a setTimeout(..., 0)
  setTimeout(function() {
      result.assert(didCloseChannelA);
      result.assert(didCloseChannelB);
      result.assert(!didCloseTransport0);
      result.assert(!didCloseTransport1);
      result.pass();
    }, 10);

  result.requestTime(1000);
});

wam.Channel.Tests.addTest
('disconnect-transport-0', function(result, cx) {
  var didCloseTransport0 = false;
  var didCloseTransport1 = false;
  var didCloseChannelA = false;
  var didCloseChannelB = false;

  this.transports[0].readyBinding.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'ok');
      result.assertEQ(value, null);
      didCloseTransport0 = true;
    });

  this.transports[1].readyBinding.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'error');
      result.assertEQ(value, null);
      didCloseTransport1 = true;
    });

  this.channelA.readyBinding.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'error');
      result.assertEQ(value.errorName, 'wam.Error.TransportDisconnect');
      didCloseChannelA = true;
    });

  this.channelB.readyBinding.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'error');
      result.assertEQ(value.errorName, 'wam.Error.TransportDisconnect');
      didCloseChannelB = true;
    });

  this.transports[0].disconnect();

  // The direct transport issues close events with a setTimeout(..., 0)
  setTimeout(function() {
      result.assert(didCloseChannelA);
      result.assert(didCloseChannelB);
      result.assert(didCloseTransport0);
      result.assert(didCloseTransport1);
      result.pass();
    }, 10);

  result.requestTime(1000);
});

wam.Channel.Tests.addTest
('disconnect-transport-1', function(result, cx) {
  var didCloseTransport0 = false;
  var didCloseTransport1 = false;
  var didCloseChannelA = false;
  var didCloseChannelB = false;

  this.transports[0].readyBinding.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'error');
      result.assertEQ(value, null);
      didCloseTransport0 = true;
    });

  this.transports[1].readyBinding.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'ok');
      result.assertEQ(value, null);
      didCloseTransport1 = true;
    });

  this.channelA.readyBinding.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'error');
      result.assertEQ(value.errorName, 'wam.Error.TransportDisconnect');
      didCloseChannelA = true;
    });

  this.channelB.readyBinding.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'error');
      result.assertEQ(value.errorName, 'wam.Error.TransportDisconnect');
      didCloseChannelB = true;
    });

  this.transports[1].disconnect();

  // The direct transport issues close events with a setTimeout(..., 0)
  setTimeout(function() {
      result.assert(didCloseChannelA);
      result.assert(didCloseChannelB);
      result.assert(didCloseTransport0);
      result.assert(didCloseTransport1);
      result.pass();
    }, 10);

  result.requestTime(1000);
});

wam.Channel.Tests.addTest
('handshake-default-decline', function(result, cx) {
  var didClose = false;

  var readyRequest = new wam.remote.ready.Request();
  readyRequest.readyBinding.onClose.addListener(function(reason, value) {
      didClose = true;
      result.assertEQ(reason, 'error');
      result.assertEQ(value.errorName, 'wam.Error.HandshakeDeclined');
      result.assertEQ(typeof value.errorArg.diagnostic, 'string');
    });

  var outMessage = this.channelA.createHandshakeMessage(null);
  readyRequest.sendRequest(outMessage);

  setTimeout(function() {
      result.assert(didClose);
      result.assert(readyRequest.readyBinding.isReadyState('ERROR'));
      result.pass();
    }, 0);

  result.requestTime(1000);
});

wam.Channel.Tests.addTest
('handshake-active-decline', function(result, cx) {
  var expectDiagnostic = 'expected diagnostic';
  var didClose = false;
  var readyResponse = null;

  this.channelB.onHandshakeOffered.addListener(function(offerEvent) {
      readyResponse = new wam.remote.ready.Response(offerEvent.inMessage);
      readyResponse.readyBinding.closeError('wam.Error.HandshakeDeclined',
                                            [expectDiagnostic]);
      offerEvent.response = readyResponse;
    });

  var readyRequest = new wam.remote.ready.Request();
  readyRequest.readyBinding.onClose.addListener(function(reason, value) {
      didClose = true;
      result.assertEQ(reason, 'error');
      result.assertEQ(value.errorName, 'wam.Error.HandshakeDeclined');
      result.assertEQ(value.errorArg.diagnostic, expectDiagnostic);
    });

  var outMessage = this.channelA.createHandshakeMessage(null);
  readyRequest.sendRequest(outMessage);

  setTimeout(function() {
      result.assert(didClose);
      result.assert(readyRequest.readyBinding.isReadyState('ERROR'));
      result.pass();
    }, 0);

  result.requestTime(1000);
});

wam.Channel.Tests.addTest
('handshake-accept', function(result, cx) {
  var readyResponse = null;

  this.channelB.onHandshakeOffered.addListener(function(offerEvent) {
      result.assert(offerEvent.inMessage instanceof wam.InMessage);
      result.assertEQ(offerEvent.inMessage.name, 'handshake');
      result.assertEQ(offerEvent.inMessage.arg.payload, null);
      readyResponse = new wam.remote.ready.Response(offerEvent.inMessage);
      readyResponse.readyBinding.ready();
      offerEvent.response = readyResponse;
    });

  var readyRequest = new wam.remote.ready.Request();
  readyRequest.readyBinding.onReady.addListener(function() {
      wam.async(result.pass, [result]);
    });

  var outMessage = this.channelA.createHandshakeMessage(null);
  readyRequest.sendRequest(outMessage);

  result.requestTime(1000);
});

wam.Channel.Tests.addTest
('handshake-dialog', function(result, cx) {
  var readyResponse = null;

  var didCloseRequest = false;
  var didCloseResponse = false;

  var expectNameA = 'name-a';
  var expectArgA = {argA: 1};

  var onMessageA = function(inMessage) {
    if (inMessage.name == 'ok')
      return;

    result.assertEQ(inMessage.name, expectNameA);
    result.assertEQ(inMessage.arg, expectArgA);
    readyRequest.readyBinding.closeOk(null);
  };

  var expectNameB = 'name-b';
  var expectArgB = {argB: 1};

  var onMessageB = function(inMessage) {
    if (inMessage.name == 'ok')
      return;

    result.assertEQ(inMessage.name, expectNameB);
    result.assertEQ(inMessage.arg, expectArgB);
    readyResponse.send(expectNameA, expectArgA);
  };

  this.channelB.onHandshakeOffered.addListener(function(offerEvent) {
      readyResponse = new wam.remote.ready.Response(offerEvent.inMessage);
      readyResponse.onMessage.addListener(onMessageB);
      readyResponse.readyBinding.onClose.addListener(function(reason, value) {
          result.assertEQ(reason, 'ok');
          result.assertEQ(value, null);
          didCloseResponse = true;
        });
      readyResponse.readyBinding.ready();
      offerEvent.response = readyResponse;
    });

  var readyRequest = new wam.remote.ready.Request();
  readyRequest.onMessage.addListener(onMessageA);
  readyRequest.readyBinding.onReady.addListener(function() {
      readyRequest.send(expectNameB, expectArgB);
    });

  readyRequest.readyBinding.onClose.addListener(function(reason, value) {
      result.assertEQ(reason, 'ok');
      result.assertEQ(value, null);
      didCloseRequest = true;
    });

  var outMessage = this.channelA.createHandshakeMessage(null);
  readyRequest.sendRequest(outMessage);

  setTimeout(function() {
      result.assert(didCloseRequest);
      result.assert(didCloseResponse);
      result.pass();
    }, 100);

  result.requestTime(1000);
});

wam.Channel.Tests.addTest
('handshake-channel-disconnect', function(result, cx) {
  var readyResponse = null;

  var didCloseRequest = false;
  var didCloseResponse = false;

  this.channelB.onHandshakeOffered.addListener(function(offerEvent) {
      readyResponse = new wam.remote.ready.Response(offerEvent.inMessage);
      readyResponse.readyBinding.onClose.addListener(function(reason, value) {
          didCloseResponse = true;
        });
      readyResponse.readyBinding.ready();
      offerEvent.response = readyResponse;
    });

  var readyRequest = new wam.remote.ready.Request();
  readyRequest.readyBinding.onReady.addListener(function() {
      wam.setImmediate(function() {
          this.channelA.disconnect('test disconnect');
        }.bind(this));
    }.bind(this));

  readyRequest.readyBinding.onClose.addListener(function(reason, value) {
      didCloseRequest = true;
    });

  var outMessage = this.channelA.createHandshakeMessage(null);
  readyRequest.sendRequest(outMessage);

  setTimeout(function() {
      result.assert(didCloseRequest);
      result.assert(didCloseResponse);
      result.pass();
    }, 10);


  result.requestTime(1000);
});

wam.Channel.Tests.addTest
('handshake-transport-disconnect', function(result, cx) {
  var readyResponse = null;

  var didCloseRequest = false;
  var didCloseResponse = false;

  this.channelB.onHandshakeOffered.addListener(function(offerEvent) {
      readyResponse = new wam.remote.ready.Response(offerEvent.inMessage);
      readyResponse.readyBinding.onClose.addListener(function(reason, value) {
          didCloseResponse = true;
        });
      readyResponse.readyBinding.ready();
      offerEvent.response = readyResponse;
    });

  var readyRequest = new wam.remote.ready.Request();
  readyRequest.readyBinding.onReady.addListener(function() {
      wam.setImmediate(function() {
          this.transports[0].disconnect();
        }.bind(this));
    }.bind(this));

  readyRequest.readyBinding.onClose.addListener(function(reason, value) {
      didCloseRequest = true;
    });

  var outMessage = this.channelA.createHandshakeMessage(null);
  readyRequest.sendRequest(outMessage);

  setTimeout(function() {
      result.assert(didCloseRequest);
      result.assert(didCloseResponse);
      result.pass();
    }, 10);


  result.requestTime(1000);
});
