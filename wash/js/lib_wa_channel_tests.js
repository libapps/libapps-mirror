// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.wa.DirectTransport');

/**
 * A suite of tests covering lib.wa.Channel, using a lib.wa.DirectTransport.
 */
lib.wa.Channel.Tests = new lib.TestManager.Suite('lib.wa.Channel.Tests');

/**
 * Run before each test to reset the state.
 */
lib.wa.Channel.Tests.prototype.preamble = function(cx) {
    var ta = new lib.wa.DirectTransport('parent');
    var tb = new lib.wa.DirectTransport('child');
    ta.connect(tb);

    window.parent = this.parent = new lib.wa.Channel(ta);
    window.parent.name = 'parent';

    window.child = this.child = new lib.wa.Channel(tb);
    window.child.name = 'child';
};

/**
 * Cause the parent channel to offer a handshake to the child.
 *
 * The test will fail if the handshake does not succeed.
 *
 * The onHandshakeReady(hsOfferMsg, hsReadyMsg) callback happens when the
 * handshake completes, and is passed two lib.wa.Message objects:
 *
 *   hsOfferMsg: The handshake offer message ('handshake') as received by the
 *               client.
 *   hsReplyMsg: The handshake reply message ('ready') as received by the
 *               parent.
 *
 * You can close the handshake by calling either hsReplyMsg.closeOk(null) or
 * hsOfferMsg.closeOk(null).  Once the handshake close successfully cleans
 * up the handhsake messages the onAllClosed function is called.
 *
 * @param {lib.TestManager.Result} result A pending test result object, used to
 *     fail the test if things don't go well.
 * @param {*} payload The payload value to send with the handshake offer.
 * @param {function(lib.wa.Message, lib.wa.Message)} onHandshakeReady The
 *     callback to invoke once the handshake succeeds on both ends.
 * @param {function()} onAllClosed The callback to invoke when all of the
 *     handshake related messages have closed.
 */
lib.wa.Channel.Tests.prototype.setupHandshake = function(
    result, payload, onHandshakeReady, onAllClosed) {

  var hsMsg = null;

  // Verify that all of the openMessage on both channels have actually gone
  // away.  If this botches, someone somewhere is not closing a message.
  // Turn on logging of one of the channels, and examine the keys of the
  // openMessages to find the culprit.
  var assertClosed = function() {
    result.assertEQ(Object.keys(this.child.openMessages).length, 0);
    result.assertEQ(Object.keys(this.parent.openMessages).length, 0);
    onAllClosed();
  }.bind(this);

  // Ding once for each message close.
  var ding = function(src, msg) {
    --ding.expected;
    //console.log('ding: ' + src + ': ' + msg.subject + ': ' + ding.expected);

    if (ding.expected == 0) {
      assertClosed();
    } else if (ding.expected < 0) {
      result.fail('Too many messages closed: ' + ding.expected);
    }
  };

  // We expect this many dings.
  ding.expected = 4;

  // Child rejected the offer, that shouldn't happen.
  this.child.onHandshakeReject.addListener(function(hsMsg, msg) {
      request.fail('Handshake rejected');
    })

  // Child accepted, as expected.
  this.child.onHandshakeAccept.addListener(function(hsMsg_, readyMsg) {
    // Save the handshake message for later.
    hsMsg = hsMsg_;

    // And track the close events.
    hsMsg_.onClose.addListener(ding.bind(null, 'child', hsMsg));
    readyMsg.onClose.addListener(ding.bind(null, 'child', readyMsg));
  }.bind(this));

  // Parent offers child a handshake.
  var offerMsg = this.parent.offerHandshake(
      null,
      function onReply(msg) {
        if (msg.name == 'ready') {
          // Offer was accepted, track the close of the accept.
          msg.onClose.addListener(ding.bind(null, 'parent', msg));
          // And notify our caller.
          onHandshakeReady(hsMsg, msg);
        }
      },
      function onError(msg) {
        result.fail('Handshake rejected');
      }
  );

  // Track the close of our offer.
  offerMsg.onClose.addListener(ding.bind(null, 'parent', offerMsg));
};

/**
 * Test that a plain vanilla handshake succeeds on both sides, can be
 * closed from the parent side, and teardown does not leave open messages.
 */
lib.wa.Channel.Tests.addTest('handshake', function(result, cx) {
    this.setupHandshake(
        result, null,
        function onHandshakeReady(hsOfferMsg, hsReadyMsg) {
          hsReadyMsg.closeOk(null);
        },
        function onAllClosed() {
          result.pass();
        });

    result.requestTime(1000);
  });

/**
 * Test that a plain vanilla handshake succeeds on both sides, can be
 * closed from the *child* side, and teardown does not leave open messages.
 */
lib.wa.Channel.Tests.addTest('handshake-child-close', function(result, cx) {
    this.setupHandshake(
        result, null,
        function onHandshakeReady(hsOfferMsg, hsReadyMsg) {
          hsOfferMsg.closeOk(null);
        },
        function onAllClosed() {
          result.pass();
        });

    result.requestTime(1000);
  });

/**
 * Test that closing the parent transport causes both ends to see the
 * onDisconnect.
 */
lib.wa.Channel.Tests.addTest('handshake-transport-close', function(result, cx)
{
  var allClosed = false;

  this.setupHandshake(
      result, null,
      function onHandshakeReady(hsOfferMsg, hsReadyMsg) {
        this.parent.transport_.disconnect();
      }.bind(this),
      function onAllClosed() {
        allClosed = true;
      });

  this.parent.onDisconnect.addListener(function(source, arg) {
      result.assertEQ(source, lib.wa.Channel.source.TRANSPORT);
    }.bind(this));

  this.child.onDisconnect.addListener(function(source, reason) {
      result.assertEQ(source, lib.wa.Channel.source.TRANSPORT);
      result.assert(allClosed);
      result.pass();
    }.bind(this));

    result.requestTime(1000);
});

/**
 * Test that closing the child transport causes both ends to see the
 * onDisconnect with the correct source.
 */
lib.wa.Channel.Tests.addTest('disconnect-child-transport', function(result, cx)
{
  var allClosed = false;

  this.setupHandshake(
        result, null,
        function onHandshakeReady(hsOfferMsg, hsReadyMsg) {
          this.child.transport_.disconnect();
        }.bind(this),
        function onAllClosed() {
          allClosed = true;
        });

    this.parent.onDisconnect.addListener(function(source, arg) {
        result.assertEQ(source, lib.wa.Channel.source.TRANSPORT);
        result.assert(allClosed);
        result.pass();
      });

    this.child.onDisconnect.addListener(function(source, reason) {
        result.assertEQ(source, lib.wa.Channel.source.TRANSPORT);
      });

    result.requestTime(1000);
  });

/**
 * Test that closing the parent channel causes both ends to see the
 * onDisconnect with a the correct source and the expected reason string.
 */
lib.wa.Channel.Tests.addTest('disconnect-parent-channel', function(result, cx) {
    var discoReason = 'planned disconnect';
    var allClosed = false;

    this.setupHandshake(
        result, null,
        function onHandshakeReady(hsOfferMsg, hsReadyMsg) {
          setTimeout(function() {
              this.parent.disconnect(discoReason);
            }.bind(this), 100);
        }.bind(this),
        function onAllClosed() {
          allClosed = true;
        });

    var parentCount = 0;
    this.parent.onDisconnect.addListener(function(source, arg) {
        result.assertEQ(source, lib.wa.Channel.source.LOCAL);
        result.assertEQ(arg, discoReason);
        result.assertEQ(parentCount++, 0);
    }.bind(this));

    var childCount = 0;
    this.child.onDisconnect.addListener(function(source, arg) {
        result.assertEQ(source, lib.wa.Channel.source.REMOTE);
        result.assertEQ(arg, discoReason);
        result.assertEQ(childCount++, 0);
        result.assert(allClosed);
        result.pass();
    }.bind(this));

    result.requestTime(1000);
  });

/**
 * Test that closing the child channel causes both ends to see the
 * onDisconnect with a the correct source and the expected reason string.
 */
lib.wa.Channel.Tests.addTest('disconnect-child-channel', function(result, cx) {
    var discoReason = 'planned disconnect';
    var allClosed = false;

    this.setupHandshake(
        result, null,
        function onHandshakeReady(hsOfferMsg, hsReadyMsg) {
          setTimeout(function() {
              this.child.disconnect(discoReason);
            }.bind(this), 100);
        }.bind(this),
        function onAllClosed() {
          allClosed = true;
        });

    var parentCount = 0;
    this.parent.onDisconnect.addListener(function(source, arg) {
        result.assertEQ(source, lib.wa.Channel.source.REMOTE);
        result.assertEQ(arg, discoReason);
        result.assertEQ(parentCount++, 0);
        result.assert(allClosed);
        result.pass();
    }.bind(this));

    var childCount = 0;
    this.child.onDisconnect.addListener(function(source, arg) {
        result.assertEQ(source, lib.wa.Channel.source.LOCAL);
        result.assertEQ(arg, discoReason);
        result.assertEQ(childCount++, 0);
    }.bind(this));

    result.requestTime(1000);
  });

/**
 * Tests that a botched handshake offer fails on both sides.
 */
lib.wa.Channel.Tests.addTest('handshake-fail', function(result, cx) {
    var rejectMsg = null;

    this.child.onHandshakeReject.addListener(function(hsMsg, msg) {
        rejectMsg = msg;
        result.assertEQ(hsMsg.subject, offerMsg.subject);
        result.assertEQ(rejectMsg.regarding, offerMsg.subject);
    }.bind(this));

    this.child.onHandshakeAccept.addListener(function(hsMsg, msg) {
        result.fail('Handshake accepted');
      });

    var offerMsg = this.parent.offerHandshake(
        'Bogus payload!',
        function onReply(msg) {
          result.fail('Handshake rejected');
        },
        function onError(msg) {
          result.assertEQ(msg.subject, rejectMsg.subject);
          result.pass();
        }
    );

    result.requestTime(1000);
  });
