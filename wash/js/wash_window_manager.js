// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wash.WindowManager = function() {
  this.windows = [];
};

wash.WindowManager.Window = function(wm) {
  this.wm = wm;
  this.pendingAppWindow_ = false;
  this.appWindow_ = null;
};

wash.WindowManager.Window.prototype.createAppWindow_ = function(
    userParams, onComplete) {
  if (this.pendingAppWindow_)
    throw new Error('Already created.');

  var params = {};
  for (var key in userParams) {
    params[key] = userParams[key];
  }

  params.frame = 'none';

  var onWindowCreated = function(appWindow) {
    this.appWindow_ = appWindow;
    this.pendingAppWindow_ = false;

    var name = params['id'] || 'anon-window'

    appWindow.contentWindow.onerror = function(message, file, line) {
      console.warn(name + ': ' + file + ', ' + line);
      console.warn(name + ': ' + message);
    }.bind(this);

    appWindow.onClosed.addListener(
        this.onClosed_.bind(this));
    appWindow.contentWindow.addEventListener(
        'load', this.onContentLoaded_.bind(this, onComplete));
  }.bind(this);

  this.pendingAppWindow_ = true;
  chrome.app.window.create(
      'html/wash_window_manager_window.html', params, onWindowCreated);
};

wash.WindowManager.Window.prototype.close = function() {
  if (!this.appWindow_)
    throw new Error('Window not open.');

  this.appWindow_.close();
};

wash.WindowManager.Window.prototype.onClosed = function() { };

wash.WindowManager.Window.prototype.onClosed_ = function() {
  this.wm.destroy(this);
  this.onClosed();
};

wash.WindowManager.Window.prototype.onContentLoaded_ = function(onComplete) {
  var document = this.document_ = this.appWindow_.contentWindow.document;
  var windowContentNode_ = document.querySelector('#wash_window_content');
  onComplete(windowContentNode_);
};

wash.WindowManager.prototype.createWindow = function(userParams, onComplete) {
  var window = new wash.WindowManager.Window(this);
  this.windows.push(window);

  window.createAppWindow_(userParams, onComplete);

  return window;
};

wash.WindowManager.prototype.destroy = function(window) {
  var index = this.windows.indexOf(window);
  this.windows.splice(index, 1);
};
