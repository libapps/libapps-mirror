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

  this.jsfs = new wam.jsfs.FileSystem();

  this.loopbackTransport = wam.transport.Direct.createPair();
  this.loopbackChannelA = new wam.Channel(
      this.loopbackTransport[0], 'direct-A');
  this.loopbackChannelB = new wam.Channel(
      this.loopbackTransport[1], 'direct-B');
  this.jsfs.publishOn(this.loopbackChannelB, 'wash');

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
   [
    function exes(cx) {
      wash.executables.install(this.jsfs, '/apps/wash/exe',
                               cx.next, cx.error);
    },

    function exes_chrome(cx) {
      wash.executables.chrome.install(this.jsfs, '/apps/chrome/exe',
                                      cx.next, cx.error);
    },

    function domfs(cx) {
      this.jsfs.makeEntry('/apps/wash/domfs', new wam.jsfs.dom.FileSystem(),
                          cx.next, cx.error);
    },

    function loopback(cx) {
      this.jsfs.makeEntry('/apps/wash/loopback',
                          new wam.jsfs.RemoteFileSystem(this.loopbackChannelA),
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
