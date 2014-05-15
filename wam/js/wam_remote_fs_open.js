// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Request/Response classes to marshal an wam.binding.fs.OpenContext over a
 * wam channel.
 */
wam.remote.fs.open = {};

/**
 * Install event listeners on the supplied wam.binding.fs.OpenContext so that
 * requests for open/seek/read/write are send over the an established
 * wam.remote.fs.handshake.Request.
 *
 * @param {wam.remote.fs.handshake.Request} handshakeRequest An established
 *   'wam.FileSystem' handshake which should service the open context.
 * @param {wam.binding.fs.OpenContext} openContext
 */
wam.remote.fs.open.Request = function(handshakeRequest, openContext) {
  this.handshakeRequest = handshakeRequest;
  this.openContext = openContext;

  this.readyRequest = new wam.remote.ready.Request(openContext);
  this.readyRequest.onMessage.addListener(this.onMessage_.bind(this));

  openContext.dependsOn(handshakeRequest.readyRequest.readyBinding);
  openContext.onOpen.addListener(this.onOpen_.bind(this));
  openContext.onSeek.addListener(this.onSeek_.bind(this));
  openContext.onRead.addListener(this.onRead_.bind(this));
  openContext.onWrite.addListener(this.onWrite_.bind(this));
};

/**
 * Handle the wam.binding.fs.OpenContext onOpen event.
 */
wam.remote.fs.open.Request.prototype.onOpen_ = function() {
  var outMessage = this.handshakeRequest.readyRequest.createMessage(
      'open',
      {'path': this.openContext.path,
       'openArg': {
         mode: this.openContext.mode
       }
      });

  this.readyRequest.sendRequest(outMessage);
};

/**
 * Handle the wam.binding.fs.OpenContext onSeek event.
 */
wam.remote.fs.open.Request.prototype.onSeek_ = function(
    value, onSuccess, onError) {
  this.readyRequest.send('seek', value, function(inMessage) {
      if (inMessage.name == 'ok') {
        onSuccess(inMessage.arg);
      } else {
        onError(inMessage.arg);
      }
    });
};

/**
 * Handle the wam.binding.fs.OpenContext onRead event.
 */
wam.remote.fs.open.Request.prototype.onRead_ = function(
    value, onSuccess, onError) {
  this.readyRequest.send('read', value, function(inMessage) {
      if (inMessage.name == 'ok') {
        onSuccess(inMessage.arg);
      } else {
        onError(inMessage.arg);
      }
    });
};

/**
 * Handle the wam.binding.fs.OpenContext onWrite event.
 */
wam.remote.fs.open.Request.prototype.onWrite_ = function(
    value, onSuccess, onError) {
  this.readyRequest.send('write', value, function(inMessage) {
      if (inMessage.name == 'ok') {
        onSuccess(inMessage.arg);
      } else {
        onError(inMessage.arg);
      }
    });
};

/**
 * Handle inbound messages on the open context.
 *
 * We don't actually expect any of these at the moment, so we just make sure
 * to close out any open messages with an error reply.
 */
wam.remote.fs.open.Request.prototype.onMessage_ = function(inMessage) {
  if (!inMessage.isFinalReply) {
    console.warn('remote open request received unexpected message: ' +
                 inMessage.name, inMessage.arg);
    if (inMessage.isOpen) {
      inMessage.replyError('wam.UnexpectedMessage',
                           [inMessage.name, inMessage.arg]);
    }
  }
};

/**
 * Connect an inbound 'open' message to the given wam.binding.fs.OpenContext.
 *
 * When the OpenContext becomes ready, this will send the 'ready' reply.
 * Additional 'seek', 'read', or 'write' replies to the 'ready' message will
 * fire onSeek/Read/Write on the OpenContext binding.
 *
 * @param {wam.InMessage} inMessage An 'open' message received in the context
 *   of a wam.FileSystem handshake.
 * @param {wam.binding.fs.OpenContext} openContext
 */
wam.remote.fs.open.Response = function(inMessage, openContext) {
  this.inMessage = inMessage;
  this.openContext = openContext;
  this.readyResponse = new wam.remote.ready.Response(inMessage, openContext);
  this.readyResponse.onMessage.addListener(this.onMessage_.bind(this));
};

/**
 * Route additional messages in the scope of this open context to the binding.
 */
wam.remote.fs.open.Response.prototype.onMessage_ = function(inMessage) {
  var onSuccess = function(value) { inMessage.replyOk(value) };
  var onError = function(value) { inMessage.replyError(value) };

  var checkOpen = function() {
    if (inMessage.isOpen)
      return true;

    console.log('Received "' + inMessage.name + '" message without a subject.');
    return false;
  };

  switch (inMessage.name) {
    case 'seek':
      if (!checkOpen())
        return;

      this.openContext.seek(inMessage.arg, onSuccess, onError);
      break;

    case 'read':
      if (!checkOpen())
        return;

      this.openContext.read(inMessage.arg, onSuccess, onError);
      break;

    case 'write':
      if (!checkOpen())
        return;

      this.openContext.write(inMessage.arg, onSuccess, onError);
      break;
  }
};
