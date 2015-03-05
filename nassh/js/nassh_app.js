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
  var DomFileSystem = axiom.fs.dom.file_system.DomFileSystem;

  this.updateAvailable = false;

  this.onInit = new lib.Event();
  this.onUpdateAvailable = new lib.Event(this.onUpdateAvailable_.bind(this));

  chrome.runtime.onUpdateAvailable.addListener(this.onUpdateAvailable);

  this.fsm = new axiom.fs.base.file_system_manager.FileSystemManager();
  this.jsfs = new axiom.fs.js.file_system.JsFileSystem(this.fsm, 'jsfs');

  this.fsm.mount(this.jsfs);

  this.jsfs.rootDirectory.mkdir('exe').then(
    function(jsdir) {
      jsdir.install(wash.exe_modules.dir);
      jsdir.install(nassh.exe);
    }.bind(this))
  .then(function() {
    return DomFileSystem.mount(this.fsm, 'html5', 'permanent')
      .then(function() {
        return DomFileSystem.mount(this.fsm, 'tmp', 'temporary');
      }.bind(this))
      .catch(function(e) {
        console.log("Error mounting DomFileSystem", e);
      }.bind(this));
    }.bind(this))
  .then(function() {
    this.onInit();
  }.bind(this));

  this.defaultEnvironment = {
    '@PATH': ['jsfs:/exe/'],
    '$HOME': 'jsfs:/',
    '$HISTFILE': 'html5:/.wash_history',
    '$PWD': 'jsfs:/',
    '$TERM': 'xterm-256color'
  };
};

nassh.App.prototype.execute = function(pathSpec, arg, env) {
  return this.fsm.createExecuteContext(
    new axiom.fs.path.Path(pathSpec), arg).then(
      function(cx) {
        cx.setEnvs(this.defaultEnvironment);
        if (env)
          cx.setEnvs(env);

        return cx.execute();
      }.bind(this));
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
