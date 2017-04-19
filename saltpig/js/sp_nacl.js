// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

sp.NaCl = function(mimeType, nmfURL, executeContext) {
  this.mimeType_ = mimeType;
  this.nmfURL_ = nmfURL;
  this.executeContext = executeContext;

  this.document_ = window.document;

  this.posixArgs_ = executeContext.arg;
  if (!(this.posixArgs_ instanceof Array)) {
    if (this.posixArgs_ != null) {
      executeContext.closeError('wam.FileSystem.Error.UnexpectedArgvType',
                                ['array']);
      return;
    }

    this.posixArgs_ = [];
  }

  this.run();
};

sp.NaCl.prototype.run = function() {
  var document = this.document_;

  var plugin = document.createElement('object');
  this.plugin_ = plugin;
  plugin.addEventListener('load', this.onPluginLoad_.bind(this));
  plugin.addEventListener('error', this.onPluginLoadError_.bind(this));
  plugin.addEventListener('abort', this.onPluginLoadAbort_.bind(this));
  plugin.addEventListener('progress', this.onPluginProgress_.bind(this));
  plugin.addEventListener('crash', this.onPluginCrash_.bind(this));
  plugin.addEventListener('message', this.onPluginMessage_.bind(this));
  plugin.setAttribute('src', this.nmfURL_);
  plugin.setAttribute('type', this.mimeType_);
  plugin.setAttribute('width', 0);
  plugin.setAttribute('height', 0);

  var tty = this.executeContext.getTTY();

  var lastSlash = this.nmfURL_.lastIndexOf('/');
  var nmfBase = this.nmfURL_.substr(lastSlash + 1);

  var params = {
    arg0: nmfBase,
    PS_TTY_PREFIX: 'stdio',
    PS_TTY_RESIZE: 'tty_resize',
    PS_TTY_COLS: tty.columns,
    PS_TTY_ROWS: tty.rows,
    PS_STDIN: '/dev/tty',
    PS_STDOUT: '/dev/tty',
    PS_STDERR: '/dev/tty',
    PS_VERBOSITY: '2',
    PS_EXIT_MESSAGE: 'exited',
  };

  var env = this.executeContext.getEnvs();
  for (var key in env) {
    if (!params.hasOwnProperty(key))
      params[key] = env[key];
  }

  for (var i = 0; i < this.posixArgs_.length; i++) {
    params['arg' + (i + 1)] = this.posixArgs_[i];
  }

  for (var key in params) {
    var param = document.createElement('param');
    param.name = key;
    param.value = params[key];
    plugin.appendChild(param);
  }

  this.executeContext.onStdIn.addListener(this.onStdIn_.bind(this));
  this.executeContext.onTTYChange.addListener(this.onTTYChange_.bind(this));
  this.executeContext.onClose.addListener(this.onExecuteClose_.bind(this));

  this.executeContext.ready();
  this.executeContext.stdout('Loading.');

  document.body.appendChild(plugin);

  // Set mimetype twice for https://crbug.com/371059
  plugin.setAttribute('type', this.mimeType_);
};

sp.NaCl.prototype.onPluginProgress_ = function(e) {
  var message;

  if (e.lengthComputable && e.total) {
    var percent = Math.round(e.loaded * 100 / e.total);
    var kbloaded = Math.round(e.loaded / 1024);
    var kbtotal = Math.round(e.total / 1024);
    message = '\r\x1b[KLoading [' +
        kbloaded + ' KiB/' +
        kbtotal + ' KiB ' +
        percent + '%]';
  } else {
    message = '.';
  }

  this.executeContext.stdout(message);
};

sp.NaCl.prototype.onPluginLoad_ = function() {
  this.executeContext.stdout('\r\x1b[K');
  this.executeContext.requestTTY({interrupt: ''});
};

sp.NaCl.prototype.onPluginLoadError_ = function(e) {
  this.executeContext.stdout(' ERROR.\n');
  this.executeContext.closeError('wam.FileSystem.Error.RuntimeError',
                                 ['Plugin load error.']);
};

sp.NaCl.prototype.onPluginLoadAbort_ = function() {
  this.executeContext.stdout(' ABORT.\n');
  this.executeContext.closeError('wam.FileSystem.Error.RuntimeError',
                                 ['Plugin load abort.']);
};

sp.NaCl.prototype.onPluginCrash_ = function() {
  if (this.executeContext.isOpen) {
    this.executeContext.closeError('wam.FileSystem.Error.RuntimeError',
                                   ['Plugin crash: exit code: ' +
                                    this.plugin_.exitStatus]);
  }
};

sp.NaCl.prototype.onPluginMessage_ = function(e) {
  var ary;

  if ((ary = e.data.match(/^stdio(.*)/))) {
    // Substr instead of ary[1] so we get newlines too.
    this.executeContext.stdout(e.data.substr(5));
  } else if ((ary = e.data.match(/^exited:(-?\d+)/))) {
    this.executeContext.closeOk(parseInt(ary[1]));
  }
};

sp.NaCl.prototype.onStdIn_ = function(value) {
  if (typeof value != 'string')
    return;

  var msg = {};
  msg['stdio'] = value;
  this.plugin_.postMessage(msg);
};

sp.NaCl.prototype.onTTYChange_ = function() {
  var tty = this.executeContext.getTTY();
  this.plugin_.postMessage({'tty_resize': [ tty.columns, tty.rows ]});
};

sp.NaCl.prototype.onExecuteClose_ = function(reason, value) {
  this.plugin_.parentElement.removeChild(this.plugin_);
};
