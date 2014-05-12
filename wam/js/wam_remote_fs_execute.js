// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Request/Response classes to marshal an wam.binding.fs.ExecuteContext over a
 * wam channel.
 */
wam.remote.fs.execute = {};

wam.remote.fs.execute.Request = function(handshakeRequest, executeContext) {
  this.handshakeRequest = handshakeRequest;
  this.executeContext = executeContext;

  this.readyRequest = new wam.remote.ready.Request(executeContext);
  this.readyRequest.onMessage.addListener(this.onMessage_.bind(this));

  executeContext.dependsOn(handshakeRequest.readyRequest.readyBinding);
  executeContext.onExecute.addListener(this.onExecute_.bind(this));
  executeContext.onTTYChange.addListener(this.onTTYChange_.bind(this));
  executeContext.onStdIn.addListener(this.onStdIn_.bind(this));
  executeContext.onSignal.addListener(this.onSignal_.bind(this));
};

wam.remote.fs.execute.Request.prototype.onExecute_ = function() {
  var outMessage = this.handshakeRequest.readyRequest.createMessage(
      'execute',
      {'path': this.executeContext.path,
       'execArg': this.executeContext.arg,
       'execEnv': this.executeContext.env_,
       'tty': this.executeContext.tty_
      });

  this.readyRequest.sendRequest(outMessage);
};

wam.remote.fs.execute.Request.prototype.onStdIn_ = function(value) {
  this.readyRequest.send('stdin', value);
};

wam.remote.fs.execute.Request.prototype.onSignal_ = function(name) {
  this.readyRequest.send('signal', name);
};

wam.remote.fs.execute.Request.prototype.onTTYChange_ = function(tty) {
  if (this.readyRequest.readyBinding.isOpen)
    this.readyRequest.send('tty-change', tty);
};

wam.remote.fs.execute.Request.prototype.onMessage_ = function(inMessage) {
  if (inMessage.name == 'stdout' || inMessage.name == 'stderr') {
    var onAck = null;
    if (inMessage.isOpen) {
      onAck = function(value) {
        inMessage.replyOk(typeof value == 'undefined' ? null : value);
      };
    }

    if (inMessage.name == 'stdout') {
      this.executeContext.stdout(inMessage.arg, onAck);
    } else {
      this.executeContext.stderr(inMessage.arg, onAck);
    }

  } else if (inMessage.name == 'tty-request') {
    this.executeContext.requestTTY(inMessage.arg);

  } else if (inMessage.name != 'stdout' && inMessage.name != 'stderr' &&
             !inMessage.isFinalReply) {
    console.warn('remote execute request received unexpected message: ' +
                 inMessage.name, inMessage.arg);
    if (inMessage.isOpen) {
      inMessage.replyError('wam.UnexpectedMessage',
                           [inMessage.name, inMessage.arg]);
    }
  }
};

/**
 *
 */
wam.remote.fs.execute.Response = function(inMessage, executeContext) {
  this.inMessage = inMessage;

  this.executeContext = executeContext;
  this.executeContext.onStdOut.addListener(this.onStdOut_, this);
  this.executeContext.onStdErr.addListener(this.onStdErr_, this);
  this.executeContext.onTTYRequest.addListener(this.onTTYRequest_.bind(this));

  this.readyResponse = new wam.remote.ready.Response(inMessage, executeContext);
  this.readyResponse.onMessage.addListener(this.onMessage_.bind(this));
};

wam.remote.fs.execute.Response.prototype.onMessage_ = function(inMessage) {
  switch (inMessage.name) {
    case 'stdin':
      var onAck = null;
      if (inMessage.isOpen) {
        onAck = function(value) {
          inMessage.replyOk(typeof value == 'undefined' ? null : value);
        };
      }

      this.executeContext.stdin(inMessage.arg, onAck);
      break;

    case 'tty-change':
      this.executeContext.setTTY(inMessage.arg);
      break;

    case 'signal':
      this.executeContext.signal(inMessage.arg.name, inMessage.arg.value);
      break;
  }
};

wam.remote.fs.execute.Response.prototype.onTTYRequest_ = function(value) {
  this.readyResponse.send('tty-request', value);
};

wam.remote.fs.execute.Response.prototype.onStdOut_ = function(value, onAck) {
  this.readyResponse.send('stdout', value,
                          (onAck ?
                           function(inMessage) { onAck(inMessage.arg) } :
                           null));
};

wam.remote.fs.execute.Response.prototype.onStdErr_ = function(value, onAck) {
  this.readyResponse.send('stderr', value,
                          (onAck ?
                           function(inMessage) { onAck(inMessage.arg) } :
                           null));
};
