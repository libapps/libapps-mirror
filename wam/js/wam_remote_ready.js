// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Request/Response classes to marshal a wam.binding.Ready over a wam channel.
 */
wam.remote.ready = {};

wam.remote.ready.Request = function(opt_readyBinding) {
  /**
   * The binding we'll use to communicate ready state.
   */
  this.readyBinding = opt_readyBinding || new wam.binding.Ready();
  this.readyBinding.onClose.addListener(this.onReadyBindingClose_.bind(this));

  /**
   * Fired for replies to outMessage.
   *
   * This will not fire for the initial 'ready' message, only for the subsequent
   * messages.
   */
  this.onMessage = new wam.Event();

  /**
   * The message we're sending that expects a 'ready' reply.
   */
  this.outMessage = null;

  /**
   * The 'ready' reply message from the remote end.
   */
  this.inReady = null;

  /**
   * The final message received from the remote end.
   */
  this.inFinal = null;

  /**
   * Messages we've sent that are still awaiting replies.
   *
   * If the remote end closes out this ready context, we close these out with
   * synthetic error replies to clean up.
   */
  this.openOutMessages_ = {};
};

/**
 * Send the initial message that will request the 'ready' reply.
 */
wam.remote.ready.Request.prototype.sendRequest = function(outMessage) {
  if (this.outMessage)
    throw new Error('Request already sent.');

  this.readyBinding.dependsOn(outMessage.channel.readyBinding);
  this.outMessage = outMessage;
  this.outMessage.onReply.addListener(this.onOutMessageReply_.bind(this));
  this.outMessage.send();
};

wam.remote.ready.Request.prototype.createMessage = function(name, arg) {
  this.readyBinding.assertReady();
  return this.inReady.createReply(name, arg);
};

/**
 * Send a message to the other end of this context.
 */
wam.remote.ready.Request.prototype.send = function(name, arg, opt_onReply) {
  this.readyBinding.assertReady();
  return this.inReady.reply(name, arg, opt_onReply);
};

wam.remote.ready.Request.prototype.onReadyBindingClose_ = function(
    reason, value) {
  if (this.outMessage && this.outMessage.isOpen) {
    // Upon receipt of our 'ok'/'error' reply the remote end is required to
    // acknowledge by sending a final reply to our outMessage (unless it has
    // already done so).  If the remotes final reply doesn't arrive within
    // `wam.remote.closeTimeoutMs` milliseconds, we'll manually close the
    // outMessage and log a warning.
    if (this.outMessage.channel.readyBinding.isOpen) {
      setTimeout(function() {
          if (this.outMessage.isOpen) {
            console.warn('Request: Manually closing "' +
                         this.outMessage.name + '" message.');
            this.outMessage.channel.injectMessage(
                'error',
                wam.mkerr('wam.Error.CloseTimeout', []),
                this.outMessage.subject);
          }
        }.bind(this), wam.remote.closeTimeoutMs);
    }
  }

  if (this.inReady && this.inReady.isOpen &&
      this.inReady.channel.readyBinding.isOpen) {
    if (reason == 'ok') {
      this.inReady.replyOk(null);
    } else if (this.inFinal) {
      this.inReady.replyError('wam.Error.ReadyAbort', [this.inFinal.arg]);
    } else {
      this.inReady.replyErrorValue(value);
    }
  }
};

/**
 * Internal handler for replies to the outMessage.
 */
wam.remote.ready.Request.prototype.onOutMessageReply_ = function(inMessage) {
  if (this.readyBinding.isReadyState('WAIT')) {
    if (inMessage.name == 'ready') {
      this.inReady = inMessage;
      this.readyBinding.ready(inMessage.arg);
    } else {
      if (inMessage.name == 'error') {
        this.readyBinding.closeErrorValue(inMessage.arg);
      } else {
        if (this.inReady.isOpen) {
          this.readyBinding.closeError('wam.UnexpectedMessage',
                                       [inMessage.name, inMessage.arg]);
        }
      }
    }
  } else if (this.readyBinding.isReadyState('READY')) {
    this.onMessage(inMessage);

    if (inMessage.isFinalReply) {
      if (inMessage.name == 'ok') {
        this.readyBinding.closeOk(inMessage.arg);
      } else {
        this.readyBinding.closeErrorValue(inMessage.arg);
      }
    }
  }
};

/**
 * @param {lib.wam.InMessage} inMessage The inbound message that expects a
 *     'ready' reply.
 */
wam.remote.ready.Response = function(inMessage, opt_readyBinding) {
  /**
   * The inbound message that expects a 'ready' reply.
   */
  this.inMessage = inMessage;

  this.readyBinding = opt_readyBinding || new wam.binding.Ready();
  this.readyBinding.dependsOn(inMessage.channel.readyBinding);
  this.readyBinding.onClose.addListener(this.onReadyBindingClose_.bind(this));
  this.readyBinding.onReady.addListener(this.onReadyBindingReady_.bind(this));

  /**
   * Our 'ready' reply.
   */
  this.outReady = null;

  /**
   * The final reply to our 'ready' message, saved for posterity.
   */
  this.inFinal = null;

  /**
   * Fired for replies to our 'ready' message, including any final 'ok' or
   * 'error' reply.
   */
  this.onMessage = new wam.Event();
};

wam.remote.ready.Response.prototype.createMessage = function(name, arg) {
  return this.inMessage.createReply(name, arg);
};

/**
 * Send an arbitrary message to the other end of this context.
 *
 * You must call replyReady() once before sending additional messages.
 */
wam.remote.ready.Response.prototype.send = function(name, arg, opt_onReply) {
  this.readyBinding.assertReady();
  return this.inMessage.reply(name, arg, opt_onReply);
};

/**
 */
wam.remote.ready.Response.prototype.onReadyBindingReady_ = function(value) {
  this.outReady = this.inMessage.reply('ready', value,
                                       this.onOutReadyReply_.bind(this));
};

wam.remote.ready.Response.prototype.onReadyBindingClose_ = function(
    reason, value) {
  if (this.inMessage && this.inMessage.isOpen &&
      this.inMessage.channel.readyBinding.isOpen) {
    if (reason == 'ok') {
      this.inMessage.replyOk(value);
    } else if (this.inFinal) {
      this.inMessage.replyError('wam.Error.ReadyAbort', [this.inFinal.arg]);
    } else {
      this.inMessage.replyErrorValue(value);
    }
  }

  if (this.outReady && this.outReady.isOpen) {
    if (this.outReady.channel.readyBinding.isOpen) {
      setTimeout(function() {
          if (this.outReady.isOpen) {
            console.warn('Response: Manually closing "' +
                         this.outReady.name + '" message.');
            this.outReady.channel.injectMessage(
                'error',
                lib.wam.errorManager.createMessageArg(
                    'wam.Error.CloseTimeout', []),
                this.outReady.subject);
          }
        }.bind(this), wam.remote.closeTimeoutMs);
    }
  }
};

wam.remote.ready.Response.prototype.onOutReadyReply_ = function(inMessage) {
  if (this.readyBinding.isReadyState('READY')) {
    this.onMessage(inMessage);

    if (inMessage.isFinalReply) {
      this.inFinal = inMessage;

      if (inMessage.name == 'ok') {
        this.readyBinding.closeOk(inMessage.arg);
      } else {
        this.readyBinding.closeErrorValue(inMessage.arg);
      }
    }
  }
};
