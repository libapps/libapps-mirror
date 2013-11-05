// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.f.Sequence');

/**
 * The singleton app instance for the nassh packaged app, created by the
 * background page.
 */
wash.App = function(manifest) {
  this.manifest = manifest;
  this.wm = new wash.WindowManager();

  this.onInit = new lib.Event(this.onInit_.bind(this));

  this.commands = new wash.Commands(this);

  this.fileSystem = new lib.wa.fs.Directory();
  this.initFileSystem(this.onInit);

  // The handshake reply message received on the app channel.
  this.hsReplyMsg_ = null;
};

/**
 * Initialize the lib.wa.fs.Directory we plan on exporting.
 */
wash.App.prototype.initFileSystem = function(onInit) {
  var fs = this.fileSystem;

  var sequence = new lib.f.Sequence
  (this,
   [function mkdirs(cx) {
      // Create these directories first.
      var initialDirs = ['/mnt', '/tmp', '/exe'];
      cx.expected = initialDirs.length;

      initialDirs.forEach(function(path) {
          console.log('initFileSystem: Creating: ' + path);
          fs.link(
              path, new lib.wa.fs.Directory(),
              cx.next,
              lib.fs.err('Initial directory failed:', cx.next));
        });
    },

    function commands(cx) {
      // Install our wash.Commands into the /exe directory.
      console.log('initFileSystem: Installing commands.');
      this.commands.install('/exe', cx.next, cx.error);
    },

    function channels(cx) {
      // Create a channel between the app and our internal filesystem using
      // a lib.wa.DirectTransport.
      console.log('initFileSystem: Creating channel.');
      lib.wa.DirectTransport.createChannelPair(
          function onHandshakeSuccess(hsOfferMsg, hsReplyMsg) {
            console.log('Channels are happy');

            hsOfferMsg.channel.name = 'filesystem';

            hsReplyMsg.channel.name = 'wash-app';
            // Uncomment for some debug logs.
            // hsReplyMsg.channel.verbose = true;

            this.hsReplyMsg_ = hsReplyMsg;

            hsOfferMsg.meta.onInput.addListener(function(msg) {
              this.fileSystem.dispatchMessage('/', msg);
            }.bind(this));

            cx.next();
          }.bind(this),
          function onHandshakeError(msg) {
            console.warn('Handshake failed: ', msg);
            cx.error();
          });
    }]);

  sequence.run(onInit, lib.fs.err('initFileSystem: Error', onInit));
};

wash.App.prototype.send = function(msg, name, opt_onReply) {
  return this.hsReplyMsg_.reply(msg, name, opt_onReply);
};

wash.App.prototype.waitReady = function(msg, name, onReply, onError) {
  return this.hsReplyMsg_.waitReady(msg, name, onReply, onError);
};

wash.App.prototype.installHandlers = function(runtime) {
  runtime.onLaunched.addListener(this.onLaunched.bind(this));
  runtime.onRestarted.addListener(this.onLaunched.bind(this));
};

wash.App.prototype.onInit_ = function() {
  console.log('wash: Application initialized.');
};

wash.App.prototype.onLaunched = function(e) {
  if (this.wm.windows.length == 0) {
    window.tw_ = new wash.TerminalWindow(this);
  } else {
    this.wm.windows[0].focus();
  }
};
