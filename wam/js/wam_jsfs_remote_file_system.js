// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.jsfs.RemoteFileSystem = function(channel) {
  wam.jsfs.Entry.call(this);
  this.channel = channel;

  this.handshakeRequest_ = null;
  this.remoteFileSystem_ = null;

  this.pendingOperations = [];
};

wam.jsfs.RemoteFileSystem.prototype = wam.jsfs.Entry.subclass(['FORWARD']);

wam.jsfs.RemoteFileSystem.prototype.getStat = function(onSuccess, onError) {
  var readyState = 'NOT-USED';
  if (this.remoteFileSystem_)
    readyState = this.remoteFileSystem_.readyState;

  wam.async(onSuccess,
            [null,
             {opList: this.opList,
              readyState: readyState,
              channelName: this.channel.name
             }]);
};

wam.jsfs.RemoteFileSystem.prototype.connect = function(onSuccess, onError) {
  if (this.remoteFileSystem_ && this.remoteFileSystem_.isReadyState('READY'))
    throw new Error('Already connected');

  this.pendingOperations.push([onSuccess, onError]);

  if (this.remoteFileSystem_ && this.remoteFileSystem_.isReadyState('WAIT'))
    return;

  this.handshakeRequest_ = new wam.remote.fs.handshake.Request(this.channel);
  this.remoteFileSystem_ = this.handshakeRequest_.fileSystem;
  this.remoteFileSystem_.onReady.addListener(this.onFileSystemReady_, this);

  this.handshakeRequest_.sendRequest();
};

wam.jsfs.RemoteFileSystem.prototype.onFileSystemReady_ = function() {
  while (this.pendingOperations.length) {
    var onSuccess = this.pendingOperations.shift()[0];
    onSuccess();
  }
};

wam.jsfs.RemoteFileSystem.prototype.onFileSystemClose_ = function(
    reason, value) {
  this.remoteFileSystem_.onReady.removeListener(this.onFileSystemReady_, this);
  this.remoteFileSystem_.onClose.remoteListener(this.onFileSystemClose_, this);

  this.handshakeRequest_ = null;
  this.remoteFileSystem_ = null;

  if (reason == 'error') {
    while (this.pendingOperations.length) {
      var onError = this.pendingOperations.shift()[1];
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
