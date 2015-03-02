// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.Event');

/**
 * The singleton app instance for the nassh packaged app, created by the
 * background page.
 */
nassh.App = function(manifest) {
  this.updateAvailable = false;

  this.onInit = new lib.Event();
  this.onUpdateAvailable = new lib.Event(this.onUpdateAvailable_.bind(this));

  chrome.runtime.onUpdateAvailable.addListener(this.onUpdateAvailable);

};

nassh.App.prototype.installHandlers = function(runtime) {
  runtime.onLaunched.addListener(this.onLaunched.bind(this));
  runtime.onRestarted.addListener(this.onLaunched.bind(this));
};

nassh.App.prototype.onLaunched = function(e) {
  chrome.app.window.create('/html/nassh.html', {
    'bounds': {
      'width': 900,
      'height': 600
    },
    'id': 'mainWindow'
  });
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
