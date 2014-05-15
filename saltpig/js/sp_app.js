// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

sp.App = function() {
  this.onInit = new lib.Event(this.onInit_.bind(this));
  this.jsfs = new wam.jsfs.FileSystem();
  var onError = function(value) { console.log('install failed: ' + value) };
  this.installExecutables(function() {
      this.installDOMFS(this.onInit, onError);
    }.bind(this),
    onError);
};

sp.App.prototype.installDOMFS = function(onSuccess, onError) {
  this.jsfs.makeEntry('domfs', new wam.jsfs.dom.FileSystem(),
                      onSuccess, onError);
};

sp.App.prototype.installExecutables = function(onSuccess, onError) {
  var nexes = {
    'curl': 'application/x-pnacl',
    'nano': 'application/x-pnacl',
    'nethack': 'application/x-pnacl',
    'python': 'application/x-pnacl',
    'unzip': 'application/x-pnacl',
    'vim': 'application/x-pnacl'
  };

  var jsexes = {};
  for (var key in nexes) {
    var callback = function(mimeType, nmf, executeContext) {
      new sp.NaCl(mimeType, nmf, executeContext);
    }.bind(null, nexes[key], key + '.nmf');

    jsexes[key] = new wam.jsfs.Executable(callback);
  }

  this.jsfs.makeEntries('/exe', jsexes, onSuccess, onError);
};

sp.App.prototype.installHandlers = function(runtime) {
  runtime.onLaunched.addListener(this.onLaunched_.bind(this));
  runtime.onRestarted.addListener(this.onLaunched_.bind(this));
};

sp.App.prototype.onInit_ = function() {
  wam.transport.ChromePort.listen
  (['kofmkpnkfdcaogpcodpmlcpfghkkkoda' /* wash tot */,
    'heabhofjglopfacdbaligldaibjogffn' /* wash dev */],
   this.onConnect_.bind(this));

  console.log('sp: Application initialized.');
};

sp.App.prototype.onLaunched_ = function(e) {
  console.log('launch!');
};

sp.App.prototype.onConnect_ = function(transport) {
  var channel = new wam.Channel(transport);
  //channel.verbose = wam.Channel.verbosity.ALL;

  this.jsfs.publishOn(channel, 'saltpig');
};
