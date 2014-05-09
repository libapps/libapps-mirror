// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.jsfs.RemoteFileSystem = function(channel) {
  wam.jsfs.Entry.call(this);

  this.channel = channel;
  this.channel.readyBinding.onReady.addListener(this.onChannelReady_, this);

  this.remoteName = null;

  this.handshakeRequest_ = null;
  this.remoteFileSystem_ = null;

  this.pendingOperations_ = [];

  this.onReady = new lib.Event();
  this.onClose = new lib.Event();

  if (this.channel.readyBinding.isReadyState('READY'))
    this.offerHandshake();
};

wam.jsfs.RemoteFileSystem.prototype = wam.jsfs.Entry.subclass(
    ['FORWARD', 'LIST']);

wam.jsfs.RemoteFileSystem.prototype.getStat = function(onSuccess, onError) {
  var readyState = 'UNEDFINED';
  if (this.remoteFileSystem_)
    readyState = this.remoteFileSystem_.readyState;

  wam.async(onSuccess,
            [null,
             {abilities: this.abilities,
              state: readyState,
              channel: this.channel.name,
              source: 'wamfs'
             }]);
};

wam.jsfs.RemoteFileSystem.prototype.connect = function(onSuccess, onError) {
  if (this.remoteFileSystem_ && this.remoteFileSystem_.isReadyState('READY'))
    throw new Error('Already connected');

  this.pendingOperations_.push([onSuccess, onError]);

  if (this.remoteFileSystem_ && this.remoteFileSystem_.isReadyState('WAIT'))
    return;

  if (this.channel.readyBinding.isReadyState('READY')) {
    this.requestHandshake();
  } else {
    this.channel.reconnect();
  }
};

wam.jsfs.RemoteFileSystem.prototype.offerHandshake = function() {
  if (this.remoteFileSystem_) {
    if (this.remoteFileSystem_.isReadyState('READY'))
      throw new Error('Already ready.');

    this.remoteFileSystem_.onReady.removeListener(
        this.onFileSystemReady_, this);
  }

  this.handshakeRequest_ = new wam.remote.fs.handshake.Request(this.channel);
  this.remoteFileSystem_ = this.handshakeRequest_.fileSystem;
  this.remoteFileSystem_.onReady.addListener(this.onFileSystemReady_, this);
  this.remoteFileSystem_.onClose.addListener(this.onFileSystemClose_, this);
  this.handshakeRequest_.sendRequest();
};

wam.jsfs.RemoteFileSystem.prototype.onChannelReady_ = function() {
  this.offerHandshake();
};

wam.jsfs.RemoteFileSystem.prototype.onFileSystemReady_ = function(value) {
  if (typeof value == 'object' && value.name)
    this.remoteName = value.name;

  while (this.pendingOperations_.length) {
    var onSuccess = this.pendingOperations_.shift()[0];
    onSuccess();
  }

  this.onReady(value);
};

wam.jsfs.RemoteFileSystem.prototype.onFileSystemClose_ = function(
    reason, value) {
  this.remoteFileSystem_.onReady.removeListener(this.onFileSystemReady_, this);
  this.remoteFileSystem_.onClose.removeListener(this.onFileSystemClose_, this);

  this.onClose(reason, value);

  this.handshakeRequest_ = null;
  this.remoteFileSystem_ = null;

  if (reason == 'error') {
    while (this.pendingOperations_.length) {
      var onError = this.pendingOperations_.shift()[1];
      onError();
    }
  }
};

wam.jsfs.RemoteFileSystem.prototype.doOrQueue_ = function(callback, onError) {
  if (this.remoteFileSystem_ && this.remoteFileSystem_.isReadyState('READY')) {
    callback();
  } else {
    this.connect(callback, onError);
  }
};

wam.jsfs.RemoteFileSystem.prototype.forwardStat = function(
    arg, onSuccess, onError) {
  var stat = function() {
    this.remoteFileSystem_.stat({path: arg.forwardPath}, onSuccess, onError);
  }.bind(this);

  this.doOrQueue_(stat, onError);
};

wam.jsfs.RemoteFileSystem.prototype.forwardList = function(
    arg, onSuccess, onError) {
  var list = function() {
    this.remoteFileSystem_.list({path: arg.forwardPath}, onSuccess, onError);
  }.bind(this);

  this.doOrQueue_(list, onError);
};

wam.jsfs.RemoteFileSystem.prototype.forwardExecute = function(arg) {
  var exec = function() {
    arg.executeContext.path = arg.forwardPath;
    var executeRequest = new wam.remote.fs.execute.Request(
        this.handshakeRequest_, arg.executeContext);
    executeRequest.onExecute_();
  }.bind(this);

  this.doOrQueue_(exec, function(value) {
      arg.executeContext.closeError(value);
    });
};
