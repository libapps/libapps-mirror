// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Request/Response classes to connect a wam.binding.fs.FileSystem over a wam
 * channel.
 */
wam.remote.fs.handshake = {};

/**
 * Back a wam.binding.fs.FileSystem binding with a wam.FileSystem handshake
 * request.
 *
 * Events sourced by the wam.binding.fs.FileSystem will become messages sent
 * regarding a wam.FileSystem handshake on the given channel.
 */
wam.remote.fs.handshake.Request = function(channel) {
  this.channel = channel;

  this.fileSystem = new wam.binding.fs.FileSystem();
  this.fileSystem.dependsOn(channel.readyBinding);

  this.fileSystem.onStat.addListener(
      this.proxySingleMessage_.bind(this, 'stat'));
  this.fileSystem.onUnlink.addListener(
      this.proxySingleMessage_.bind(this, 'unlink'));
  this.fileSystem.onList.addListener(
      this.proxySingleMessage_.bind(this, 'list'));

  this.fileSystem.onExecuteContextCreated.addListener(
      this.onExecuteContextCreated_.bind(this));
  this.fileSystem.onOpenContextCreated.addListener(
      this.onOpenContextCreated_.bind(this));

  this.readyRequest = new wam.remote.ready.Request(this.fileSystem);
};

/**
 * Send the handshake offer message.
 */
wam.remote.fs.handshake.Request.prototype.sendRequest = function() {
  if (!wam.changelogVersion)
    throw new Error('Unknown changelog version');

  var outMessage = this.channel.createHandshakeMessage
  ({ protocol: wam.remote.fs.protocolName,
     version: wam.changelogVersion
   });

  this.readyRequest.sendRequest(outMessage);
};

/**
 * Proxy a wam.binding.fs.FileSystem event which maps to a single wam
 * message that expects an immediate 'ok' or 'error' reply.
 */
wam.remote.fs.handshake.Request.prototype.proxySingleMessage_ = function(
    name, arg, onSuccess, onError) {
  this.readyRequest.send(name, {path: arg.path}, function(inMessage) {
      if (inMessage.name == 'ok') {
        onSuccess(inMessage.arg);
      } else {
        onError(inMessage.arg);
      }
    });
};

/**
 * Create a wam.remote.fs.execute.Request instance to handle the proxying of an
 * execute context.
 */
wam.remote.fs.handshake.Request.prototype.onExecuteContextCreated_ = function(
    executeContext) {
  new wam.remote.fs.execute.Request(this, executeContext);
};

/**
 * Create a wam.remote.fs.open.Request instance to handle the proxying of an
 * open context.
 */
wam.remote.fs.handshake.Request.prototype.onOpenContextCreated_ = function(
    openContext) {
  new wam.remote.fs.open.Request(this, openContext);
};

/**
 * Front a wam.binding.fs.FileSystem binding with a wam.FileSystem handshake
 * response.
 *
 * Inbound messages to the handshake will raise events on the binding.
 *
 * @param {wam.InMessage} inMessage The inbound 'handshake' message.
 * @param {wam.binding.fs.FileSystem} The binding to excite.
 */
wam.remote.fs.handshake.Response = function(inMessage, fileSystem) {
  this.inMessage = inMessage;
  this.fileSystem = fileSystem;

  this.readyResponse = new wam.remote.ready.Response(inMessage);
  this.readyResponse.readyBinding.dependsOn(fileSystem);
  this.readyResponse.onMessage.addListener(this.onMessage_.bind(this));

  this.readyBinding = this.readyResponse.readyBinding;
};

/**
 * Mark the binding as ready.
 *
 * @param {Object} value The ready value to provide.  This may be an object
 *   with a 'name' property, suggesting a short name for this file system.
 */
wam.remote.fs.handshake.Response.prototype.sendReady = function(value) {
  this.readyResponse.readyBinding.ready(value || null);
};

/**
 * Handle inbound messages regarding the handshake.
 */
wam.remote.fs.handshake.Response.prototype.onMessage_ = function(inMessage) {
  switch (inMessage.name) {
    case 'stat':
      this.fileSystem.stat(
          inMessage.arg,
          function(value) { inMessage.replyOk(value) },
          function(value) { inMessage.replyErrorValue(value) });
      break;

    case 'unlink':
      this.fileSystem.unlink(
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

    case 'open':
      var openContext = this.fileSystem.createOpenContext();
      var openReply = new wam.remote.fs.open.Response(
          inMessage, openContext);
      openContext.open(inMessage.arg.path, inMessage.arg.openArg);
      break;
  }
};
