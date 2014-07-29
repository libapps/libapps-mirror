// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.Event', 'lib.f.Sequence');

/**
 * The singleton app instance for the nassh packaged app, created by the
 * background page.
 */
nassh.App = function(manifest) {
  this.updateAvailable = false;

  this.onInit = new lib.Event();
  this.onUpdateAvailable = new lib.Event(this.onUpdateAvailable_.bind(this));

  chrome.runtime.onUpdateAvailable.addListener(this.onUpdateAvailable);

  this.prefs = new nassh.PreferenceManager();
  this.prefs.addObservers(null, {
      'enable-wam': function(v) {
        if (!this.jsfs)
          return;

        if (v) {
          this.startWam();
        } else {
          this.stopWam();
        }
      }.bind(this)
  });

  this.prefs.readStorage(function() {
      this.jsfs = new wam.jsfs.FileSystem();
      this.initFileSystem_(this.onInit);
    }.bind(this));
};

/**
 * Initialize the lib.wam.fs.Directory we plan on exporting.
 */
nassh.App.prototype.initFileSystem_ = function(onInit) {
  var sequence = new lib.f.Sequence
  (this,
   [
    function commands(cx) {
      nassh.executables.install(this.jsfs, '/exe', cx.next, cx.error);
    },

    function domfs(cx) {
      this.jsfs.makeEntry('domfs', new wam.jsfs.dom.FileSystem(),
                          cx.next, cx.error);
    },

    function accept(cx) {
      // Start accepting connections.
      if (this.prefs.get('enable-wam'))
        this.startWam();

      cx.next();
    }]);

  sequence.run(onInit, lib.fs.err('initFileSystem: Error', onInit));
};

nassh.App.prototype.stopWam = function() {
  wam.transport.ChromePort.listen(null, null);
};

nassh.App.prototype.startWam = function() {
  wam.transport.ChromePort.listen(this.prefs.get('wam-whitelist'),
                                  this.onConnect.bind(this));
};

/**
 * Called by lib.wam.ChromePortTransport when we get an inbound connection.
 */
nassh.App.prototype.onConnect = function(transport) {
  var channel = new wam.Channel(transport);
  //channel.verbose = wam.Channel.verbosity.ALL;

  this.jsfs.publishOn(channel, 'nassh');
};

nassh.App.prototype.onUpdateAvailable_ = function(e) {
  this.updateAvailable = true;

  var onQuery = function(rv) {
    if (!rv.length) {
      console.log('Reloading for update.');
      chrome.runtime.reload();
    } else {
      console.log('Not reloading for update, ' + rv.length +
                  ' windows still open.');
    }
  };

  var checkTabs = function() {
    chrome.tabs.query({url: chrome.runtime.getURL('html/nassh.html')},
                      onQuery);
  };

  chrome.tabs.onRemoved.addListener(checkTabs);
  checkTabs();
};

/**
 * The firstCallback of the onInit event.
 */
nassh.App.prototype.onInit_ = function() {
  console.log('nassh: Application initialized: ' + chrome.runtime.getURL(''));
};
