// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Request/Response classes to marshal a wam.binding.fs.FileSystem over a wam
 * channel.
 */
wam.remote.fs.handshake = {};

/**
 * Context for a wam.FileSystem handshake request.
 */
wam.remote.fs.handshake.Request = function(channel) {
  this.channel = channel;

  this.fileSystem = new wam.binding.fs.FileSystem();
  this.fileSystem.dependsOn(channel.readyBinding);
  this.fileSystem.onStat.addListener(this.onStat_.bind(this));
  this.fileSystem.onList.addListener(this.onList_.bind(this));
  this.fileSystem.onExecuteContextCreated.addListener(
      this.onExecuteContextCreated_.bind(this));

  this.readyRequest = new wam.remote.ready.Request(this.fileSystem);
};

/**
 * Send the handshake offer message.
 */
wam.remote.fs.handshake.Request.prototype.sendRequest = function() {
  var outMessage = this.channel.createHandshakeMessage
  ({ protocol: wam.remote.fs.protocolName,
     version: wam.remote.fs.protocolVersion
   });

  this.readyRequest.sendRequest(outMessage);
};

wam.remote.fs.handshake.Request.prototype.onStat_ = function(
    arg, onSuccess, onError) {
  this.readyRequest.send('stat', {path: arg.path}, function(inMessage) {
      if (inMessage.name == 'ok') {
        onSuccess(inMessage.arg);
      } else {
        onError(inMessage.arg);
      }
    });
};

wam.remote.fs.handshake.Request.prototype.onList_ = function(
    arg, onSuccess, onError) {
  this.readyRequest.send('list', {path: arg.path}, function(inMessage) {
      if (inMessage.name == 'ok') {
        onSuccess(inMessage.arg);
      } else {
        onError(inMessage.arg);
      }
    });
};

/**
 *
 */
wam.remote.fs.handshake.Request.prototype.onExecuteContextCreated_ = function(
    executeContext) {
  new wam.remote.fs.execute.Request(this, executeContext);
};

/**
 *
 */
wam.remote.fs.handshake.Response = function(inMessage, fileSystem) {
  this.inMessage = inMessage;
  this.fileSystem = fileSystem;

  this.readyResponse = new wam.remote.ready.Response(inMessage);
  this.readyResponse.readyBinding.dependsOn(fileSystem);
  this.readyResponse.onMessage.addListener(this.onMessage_.bind(this));

  this.readyBinding = this.readyResponse.readyBinding;
};

wam.remote.fs.handshake.Response.prototype.sendReady = function() {
  this.readyResponse.readyBinding.ready(null);
};

wam.remote.fs.handshake.Response.prototype.onMessage_ = function(inMessage) {
  switch (inMessage.name) {
    case 'stat':
      this.fileSystem.stat(
          inMessage.arg,
          function(value) { inMessage.replyOk(value) },
          function(value) { inMessage.replyErrorValue(value) });
      break;

    case 'list':
      this.fileSystem.list(
          inMessage.arg,
          function(value) { inMessage.replyOk(value) },
          function(value) { inMessage.replyErrorValue(value) });
      break;

    case 'execute':
      var executeContext = this.fileSystem.createExecuteContext();
      var executeReply = new wam.remote.fs.execute.Response(
          inMessage, executeContext);
      executeContext.setEnvs(inMessage.arg.execEnv);
      executeContext.setTTY(inMessage.arg.tty || {});
      executeContext.execute(inMessage.arg.path, inMessage.arg.execArg);
      break;
  }
};
