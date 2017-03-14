// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Create a new outbound message for the given channel.
 *
 * @param {wam.Channel} channel The channel that received the value.
 * @param {Object} value The value received on the channel.
 */
wam.OutMessage = function(channel, name, arg, opt_regardingMessage) {
  if (!(channel instanceof wam.Channel))
    throw new Error('Invalid channel');

  this.channel = channel;
  this.name = name;
  this.arg = arg;
  this.subject = null;

  if (opt_regardingMessage) {
    this.regardingMessage = opt_regardingMessage;
    this.regardingSubject = opt_regardingMessage.subject;
  }

  /**
   * True if this is the final reply we're going to send.
   */
  this.isFinalReply = (name == 'ok' || name == 'error');

  /**
   * True if we're expecting replies.
   */
  this.isOpen = false;

  /**
   * Invoked when we receive a reply to this message.
   */
  this.onReply = new wam.Event();

  /**
   * Invoked when this message is actually sent over the wire.
   */
  this.onSend = new wam.Event();

  /**
   * Invoked when the message has received its last reply.
   */
  this.onClose = new wam.Event(this.onClose_.bind(this));
};

/**
 * Convert this object into a plain JS Object ready to send over a transport.
 */
wam.OutMessage.prototype.toValue = function() {
  var value = {
    'name': this.name,
    'arg': this.arg,
  };

  if (this.subject)
    value['subject'] = this.subject;

  if (this.regardingSubject)
    value['regarding'] = this.regardingSubject;

  return value;
};

/**
 * Prepare this message for sending, then send it.
 *
 * This is the correct way to cause a message to be sent.  Do not directly
 * call wam.Channel..sendMessage, as you'll end up skipping the bookkeeping
 * done by this method.
 */
wam.OutMessage.prototype.send = function() {
  if (this.onReply.observers.length && !this.subject) {
    this.subject = wam.guid();
    this.isOpen = true;
    this.channel.registerOpenOutMessage(this);
  }

  if (this.regardingMessage && !this.regardingMessage.isOpen)
    throw new Error('Reply to a closed message.');

  if (this.isFinalReply)
    this.regardingMessage.onClose();

  if (this.regardingMessage)
    this.regardingMessage.onReply(this);

  var onSend = this.onSend.observers.length > 0 ? this.onSend : null;
  this.channel.sendMessage(this, onSend);
};

/**
 * Internal bookkeeping needed when the message is closed.
 */
wam.OutMessage.prototype.onClose_ = function() {
  this.isOpen = false;
};
