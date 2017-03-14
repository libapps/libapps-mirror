// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Create a new inbound message for the given channel from the given JSON value.
 *
 * @param {wam.Channel} channel The channel that received the value.
 * @param {Object} value The value received on the channel.
 */
wam.InMessage = function(channel, value) {
  this.channel = channel;
  this.name = value.name;
  this.arg = value.arg;

  if (value.subject) {
    this.subject = value.subject;
    this.isOpen = true;
  }

  if (value.regarding) {
    this.regardingSubject = value.regarding || null;
    this.regardingMessage = channel.getOpenOutMessage(value.regarding);
  }

  this.isFinalReply = !!(value.name == 'ok' || value.name == 'error');

  /**
   * True if this message did not actually arrive on the transport.  Indicates
   * it was created locally because we can't on the remote end to send some
   * required final reply.
   */
  this.isSynthetic = false;

  /**
   * Invoked when we send any reply to this message.
   */
  this.onReply = new wam.Event();

  /**
   * Invoked when we send our final reply to this message.
   */
  this.onClose = new wam.Event(this.onClose_.bind(this));
};

/**
 * Create a wam.OutMessage which is a reply to this message.
 *
 * @param {string} name  The name of the message to reply with.
 * @param {*} arg  The message arg for the reply.
 * @param {function(wam.InMessage)} opt_onReply  The callback to invoke
 *     with message replies.
 */
wam.InMessage.prototype.createReply = function(name, arg) {
  if (!this.isOpen)
    throw new Error('Attempt to reply to closed message.');

  return new wam.OutMessage(this.channel, name, arg, this);
};

/**
 * Send a reply to this message.
 *
 * If you're expecting a reply to this message you *must* provide a callback
 * function to opt_onReply, otherwise the reply will not get a 'subject' and
 * will not be eligible for replies.
 *
 * After replying you may attach *additional* reply handlers to the onReply
 * event of the returned wam.OutMessage.
 *
 * @param {string} name  The name of the message to reply with.
 * @param {*} arg  The message arg for the reply.
 * @param {function(wam.InMessage)} opt_onReply  The callback to invoke
 *     with message replies.
 */
wam.InMessage.prototype.reply = function(name, arg, opt_onReply) {
  var outMessage = this.createReply(name, arg);
  if (opt_onReply)
    outMessage.onReply.addListener(opt_onReply);

  outMessage.send();
  return outMessage;
};

/**
 * Reply with a final 'ok' message.
 */
wam.InMessage.prototype.replyOk = function(arg, opt_onReply) {
  return this.reply('ok', arg, opt_onReply);
};

/**
 * Reply with a final 'error' message.
 */
wam.InMessage.prototype.replyError = function(
    errorName, argList, opt_onReply) {
  var errorValue = wam.errorManager.createValue(errorName, argList);
  return this.reply('error', errorValue, opt_onReply);
};

/**
 * Reply with a final 'error' message.
 */
wam.InMessage.prototype.replyErrorValue = function(
    errorValue, opt_onReply) {
  return this.reply('error', errorValue, opt_onReply);
};

/**
 * Internal bookkeeping needed when the message is closed.
 */
wam.InMessage.prototype.onClose_ = function() {
  if (!this.subject)
    console.warn('Closed inbound message without a subject.');

  if (this.isOpen) {
    this.isOpen = false;
  } else {
    console.warn('Inbound message closed more than once.');
  }
};

/**
 * Try to route a message to one of the provided event handlers.
 *
 * The handlers object should be keyed by message name.
 *
 * If the message name is not handled and the message requires a reply we
 * close the reply with an error and return false.  If the message does not
 * require a reply, we just return false.
 *
 * If you want to handle your own unknown messages, include a handler for
 * '__unknown__'.
 *
 * @param {Object} obj The `this` object to use when calling the message
 *     handlers.
 * @param {Object} handlers A map of message-name -> handler function.
 */
wam.InMessage.prototype.dispatch = function(obj, handlers, opt_args) {
  var name = this.name;

  if (!handlers.hasOwnProperty(this.name)) {
    if (this.name == 'ok' || this.name == 'error')
      return true;

    if (handlers.hasOwnProperty('__unknown__')) {
      name = '__unknown__';
    } else {
      console.log('Unknown Message: ' + name);
      if (this.isOpen)
        this.replyError('wam.Error.UnknownMessage', [name]);

      return false;
    }
  }

  if (opt_args) {
    opt_args.push(this)
    handlers[name].apply(obj, opt_args);
  } else {
    handlers[name].call(obj, this);
  }
  return true;
};
