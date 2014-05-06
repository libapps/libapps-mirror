// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.f.Sequence');

/**
 * The singleton app instance for the wash packaged app, created by the
 * background page.
 */
wash.App = function() {
  this.wm = new wash.WindowManager();

  this.onInit = new lib.Event(this.onInit_.bind(this));

  this.localFS = new wam.binding.fs.FileSystem();
  this.localFS.ready();
  this.jsfs = new wam.jsfs.FileSystem();
  this.jsfs.addBinding(this.localFS);

  this.loopbackTransport = wam.transport.Direct.createPair();
  this.loopbackChannelA = new wam.Channel(this.loopbackTransport[0], 'A-to-B');
  this.loopbackChannelB = new wam.Channel(this.loopbackTransport[1], 'B-to-A');
  this.loopbackChannelB.onHandshakeOffered.addListener(function(offerEvent) {
      if (!wam.remote.fs.testOffer(offerEvent.inMessage))
        return;

      this.handshakeResponse = new wam.remote.fs.handshake.Response(
          offerEvent.inMessage, this.localFS);

      this.handshakeResponse.sendReady();
      offerEvent.response = this.handshakeResponse;
    }.bind(this));

  if (true) {
    this.loopbackChannelA.verbose =
        this.loopbackChannelB.verbose = (wam.Channel.verbosity.OUT |
                                         wam.Channel.verbosity.SYNTHETIC);
  }

  this.initFileSystem(this.onInit);
};

/**
 * Initialize the lib.wam.fs.Directory we plan on exporting.
 */
wash.App.prototype.initFileSystem = function(onInit) {
  var sequence = new lib.f.Sequence
  (this,
   [function mkdirs(cx) {
      this.jsfs.makePaths(['/mnt', '/exe'], cx.next, cx.error);
    },

    function commands(cx) {
      wash.executables.install(this.jsfs, '/exe', cx.next, cx.error);
    },

    function loopback(cx) {
      this.jsfs.makeEntries(
          '/mnt',
          {'loopback': new wam.jsfs.RemoteFileSystem(this.loopbackChannelA)},
          cx.next, cx.error);
    }]);

  sequence.run(onInit, function(value) {
      console.log('initFileSystem: Error:', value);
      onInit();
    });
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
