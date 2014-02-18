// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.wam.DirectTransport');

/**
 * A suite of tests covering lib.ipc.Channel, using a lib.ipc.DirectTransport.
 */
lib.wam.fs.Tests = new lib.TestManager.Suite('lib.wam.fs.Tests');

/**
 * Run before each test to reset the state.
 */
lib.wam.fs.Tests.prototype.preamble = function(cx) {
    var ta = new lib.wam.DirectTransport('parent');
    var tb = new lib.wam.DirectTransport('child');
    ta.connect(tb);

    window.parent = this.parent = new lib.wam.Channel(ta);
    window.parent.name = 'parent';

    window.child = this.child = new lib.wam.Channel(tb);
    window.child.name = 'child';

    this.childFileSystem = new lib.wam.fs.Directory();
};

/**
 * Same as lib.wam.Channel.prototype.setupHandshake, except automatically
 * route handshake-ready replies to the this.childFileSystem.
 */
lib.wam.fs.Tests.prototype.setupHandshake = function(
    result, payload, onHandshakeReady, onAllClosed) {

  lib.wam.Channel.Tests.prototype.setupHandshake.call(
      this, result, payload,
      function(hsOfferMsg, hsReadyMsg) {
        // Route ready replies to the filesystem.
        hsOfferMsg.meta.onInput.addListener(function(msg) {
            this.childFileSystem.dispatchMessage('/', msg);
          }.bind(this));

        onHandshakeReady(hsOfferMsg, hsReadyMsg);
      }.bind(this),
      onAllClosed);
};

/**
 * Open a directory across a channel, read it, close it, verify teardown.
 */
lib.wam.fs.Tests.addTest('open-read-close', function(result, cx) {
    var readHappened = false;

    var onHandshakeReady = function(hsOfferMsg, hsReadyMsg) {
      var openMsg = hsReadyMsg.waitReady
      ('open', {path: '/test-directory'},
       function onSuccess(openReadyMsg) {
         if (openReadyMsg.name != 'ready')
           return;

         openReadyMsg.reply('read', null, function(msg) {
             msg.parent.close();

             result.assertEQ(msg.name, 'ok');
             result.assertEQ(typeof msg.arg, 'object');
             result.assertEQ(typeof msg.arg.entries, 'object');
             result.assertEQ(Object.keys(msg.arg.entries).length, 0);

             openReadyMsg.closeOk(null);

             readHappened = true;
           });
       },
       function onError(msg) {
         result.fail('Error opening: ' + msg.arg.name + ': ' +
                     msg.arg.arg);
       });

      openMsg.onClose.addListener(function() { hsOfferMsg.closeOk(null) });
    };

    var onLinkSuccess = function() {
      this.setupHandshake(
          result, null,
          onHandshakeReady,
          function onAllClosed() {
            result.assert(readHappened);
            result.pass();
          });
    }.bind(this);

    this.childFileSystem.link(
        'test-directory', new lib.wam.fs.Directory,
        onLinkSuccess,
        function onError() {
          result.fail('Link failed');
        });

    result.requestTime(1000);
  });

/**
 * Execute a command across a channel, read some output, send some input,
 * watch it exit and verify the teardown.
 */
lib.wam.fs.Tests.addTest('execute-and-stuff', function(result, cx) {
    var execClosed = false;

    // This is the function we're going to try to execute.
    var test = function(execMsg) {
      var argv = execMsg.arg.argv;

      // Check the initial conditions.
      result.assertEQ(execMsg.arg.path, '/test');
      result.assertEQ(typeof argv, 'object');
      result.assertEQ(Object.keys(argv).length, 1);
      result.assertEQ(argv['hello'], 'world');

      // Set up a callback to listen for additional input.
      execMsg.meta.onInput.addListener(function(msg) {
          if (msg.name == 'test-closeme')
            execMsg.closeOk(null);
        });

      // Send a reply to the caller.
      execMsg.reply('strout', 'hello yourself');
    };

    var execReadyMsg = null;

    // This is called when our 'execute' message receives a reply.
    var onExecuteReply = function(msg) {
      if (msg.name == 'ready') {
        // The first reply, 'ready', just means our execute message was properly
        // routed.  Additional input can be sent as a reply to this message.
        execReadyMsg = msg;

      } else if (msg.name == 'strout') {
        // This is the message we expect to hear back from the executable.
        result.assertEQ(msg.arg, 'hello yourself');

        // Send this made-up message to the executable.  It should exit when
        // it receives the message.
        execReadyMsg.reply('test-closeme', null);

      } else if (msg.isFinalReply) {
        // Ensure that the command exited cleanly.
        execClosed = true;
      }
    };

    var onHandshakeReady = function(hsOfferMsg, hsReadyMsg) {
      // Execute '/test', wait for the 'ready' message, and pass it and all
      // subsequent replies to onExecuteReply.
      var execMsg = hsReadyMsg.waitReady
      ('execute', {path: '/test', argv: {'hello': 'world'}},
       onExecuteReply,
       function onError(name, arg) {
         result.fail('Execute failed: ' + name + ': ' + arg);
       }
      );

      execMsg.onClose.addListener(function() {
          hsReadyMsg.closeOk(null);
        });
    }.bind(this);

    var onLinkSuccess = function() {
      this.setupHandshake(
          result, null,
          onHandshakeReady,
          function onAllClosed() {
            result.assert(execClosed);
            result.pass();
          });
    }.bind(this);

    this.childFileSystem.link(
        '/test',
        new lib.wam.fs.Executable(test),
        onLinkSuccess,
        function onError(name, arg) {
          result.fail('Error linking executable: ' + name + ': ' + arg);
        });

    result.requestTime(1000);
  });
