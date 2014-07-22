// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * A jsfs.Entry subclass that proxies to a wam file system connected via a
 * wam.Channel.
 *
 * @param {wam.Channel} channel The channel hosting the wam file system.
 */
wam.jsfs.RemoteFileSystem = function(channel) {
  wam.jsfs.Entry.call(this);

  this.channel = channel;
  this.channel.readyBinding.onReady.addListener(this.onChannelReady_, this);

  this.remoteName = null;

  this.handshakeRequest_ = null;
  this.remoteFileSystem_ = null;

  this.pendingOperations_ = [];

  this.onReady = new wam.Event();
  this.onClose = new wam.Event();

  if (this.channel.readyBinding.isReadyState('READY'))
    this.offerHandshake();
};

/**
 * We're an Entry subclass that is able to FORWARD and LIST.
 */
wam.jsfs.RemoteFileSystem.prototype = wam.jsfs.Entry.subclass(
    ['FORWARD', 'LIST']);

/**
 * Return a wam 'stat' value for the FileSystem itself.
 *
 * This is a jsfs.Entry method needed as part of the 'LIST' action.
 */
wam.jsfs.RemoteFileSystem.prototype.getStat = function(onSuccess, onError) {
  var readyState = 'UNDEFINED';
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

/**
 * Reconnect the wam.Channel if necessary, then offer a wam.FileSystem
 * 'handshake' message.
 *
 * @param {function()} onSuccess
 * @param {function(wam.Error)} onError
 */
wam.jsfs.RemoteFileSystem.prototype.connect = function(onSuccess, onError) {
  if (this.remoteFileSystem_ && this.remoteFileSystem_.isReadyState('READY'))
    throw new Error('Already connected');

  this.pendingOperations_.push([onSuccess, onError]);

  if (this.remoteFileSystem_ && this.remoteFileSystem_.isReadyState('WAIT'))
    return;

  if (this.channel.readyBinding.isReadyState('READY')) {
    this.offerHandshake();
  } else {
    this.channel.reconnect();
  }
};

/**
 * Offer a wam.FileSystem 'handshake' message over the associated channel.
 */
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

/**
 * Handle the onReady event from the channel's ready binding.
 */
wam.jsfs.RemoteFileSystem.prototype.onChannelReady_ = function() {
  this.offerHandshake();
};

/**
 * Handle the onReady event from the handshake offer.
 */
wam.jsfs.RemoteFileSystem.prototype.onFileSystemReady_ = function(value) {
  if (typeof value == 'object' && value.name)
    this.remoteName = value.name;

  while (this.pendingOperations_.length) {
    var onSuccess = this.pendingOperations_.shift()[0];
    onSuccess();
  }

  this.onReady(value);
};

/**
 * Handle an onClose from the handshake offer.
 */
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

/**
 * If this FileSystem isn't ready, try to make it ready and queue the callback
 * for later, otherwise call it right now.
 *
 * @param {function()} callback The function to invoke when the file system
 *   becomes ready.
 * @param {function(wam.Error)} onError The function to invoke if the
 *   file system fails to become ready.
 */
wam.jsfs.RemoteFileSystem.prototype.doOrQueue_ = function(callback, onError) {
  if (this.remoteFileSystem_ && this.remoteFileSystem_.isReadyState('READY')) {
    callback();
  } else {
    this.connect(callback, onError);
  }
};

/**
 * Forward a stat call to the file system.
 *
 * This is a jsfs.Entry method needed as part of the 'FORWARD' action.
 */
wam.jsfs.RemoteFileSystem.prototype.forwardStat = function(
    arg, onSuccess, onError) {
  this.doOrQueue_(function() {
      this.remoteFileSystem_.stat({path: arg.forwardPath}, onSuccess, onError);
    }.bind(this), onError);
};

/**
 * Forward an unlink call to the file system.
 *
 * This is a jsfs.Entry method needed as part of the 'FORWARD' action.
 */
wam.jsfs.RemoteFileSystem.prototype.forwardUnlink = function(
    arg, onSuccess, onError) {
  this.doOrQueue_(function() {
      this.remoteFileSystem_.unlink({path: arg.forwardPath},
                                    onSuccess, onError);
    }.bind(this),
    onError);
};

/**
 * Forward a list call to the LocalFileSystem.
 *
 * This is a jsfs.Entry method needed as part of the 'FORWARD' action.
 */
wam.jsfs.RemoteFileSystem.prototype.forwardList = function(
    arg, onSuccess, onError) {
  this.doOrQueue_(function() {
      this.remoteFileSystem_.list({path: arg.forwardPath}, onSuccess, onError);
    }.bind(this),
    onError);
};

/**
 * Forward a wam 'execute' to this file system.
 *
 * This is a jsfs.Entry method needed as part of the 'FORWARD' action.
 */
wam.jsfs.RemoteFileSystem.prototype.forwardExecute = function(arg) {
  this.doOrQueue_(function() {
      arg.executeContext.path = arg.forwardPath;
      var executeRequest = new wam.remote.fs.execute.Request(
          this.handshakeRequest_, arg.executeContext);
      executeRequest.onExecute_();
    }.bind(this),
    function(value) { arg.executeContext.closeError(value) });
};

/**
 * Forward a wam 'open' to this file system.
 *
 * This is a jsfs.Entry method needed as part of the 'FORWARD' action.
 */
wam.jsfs.RemoteFileSystem.prototype.forwardOpen = function(arg) {
  this.doOrQueue_(function() {
      arg.openContext.path = arg.forwardPath;
      var openRequest = new wam.remote.fs.open.Request(
          this.handshakeRequest_, arg.openContext);
      openRequest.onOpen_();
    }.bind(this),
    function(value) { arg.openContext.closeError(value) });
};
