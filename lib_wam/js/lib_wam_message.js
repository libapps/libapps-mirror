// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.wam.Message = function(channel) {
  this.channel = channel;

  /**
   * True if this message is expecting a response, false if not, null until
   * initialized.
   */
  this.isOpen = null;

  /**
   * @type {lib.wam.Message.status}.
   */
  this.status = lib.wam.Message.status.INIT;

  /**
   * A token conveying the meaning of the message.
   * @type {string}
   */
  this.name = null;

  /**
   * The message argument.
   *
   * Typically an object, sometimes a string for simple messages.  This can be
   * any serializable JavaScript value.  Conventions are implied by the message
   * name.
   *
   * @type {*}
   */
  this.arg = null;

  /**
   * Out-of-band, message specific context for this message.
   *
   * This is not sent as part of the message payload.
   */
  this.meta = {};

  /**
   * A globally unique identifier for this message.
   *
   * This only exists when a reply is expected.
   *
   * @type {string}
   */
  this.subject = null;

  /**
   * The subject of the original message, if this is a reply.
   *
   * @type {string}
   */
  this.regarding = null;

  /**
   * The original message, if this is a reply.
   *
   * This only applies to outbound replies.  The parent is ALWAYS an inbound
   * message.
   *
   * @type {lib.wam.Message}
   */
  this.parent = null;

  /**
   * True if this is the final reply on the subject.
   *
   * When a message requires a reply, the recipient must send at least one
   * reply, and the final reply it sends must be marked as final.
   *
   * This lets the sender know it can disconnect its reply handler.
   *
   * @type {boolean}
   */
  this.isFinalReply = null;

  /**
   * The function to invoke with message replies.
   *
   * @type {function}
   */
  this.onReply = null;

  /**
   * Event fired when this message is closed.
   */
  this.onClose = new lib.Event();

  // Stack trace that lead to the message close, only set in the case of
  // a double close.  For debugging use.
  this.closeStack_ = null;
};

/**
 * Status of this message.
 *
 * All messages start at INIT.  Outbound messages are always SENT, inbound
 * messages are always RECV.
 */
lib.wam.Message.status = {
  /**
   * The message has not been initialized.
   */
  INIT: 'INIT',

  /**
   * An attempt was made to send the message from our end.
   */
  SENT: 'SENT',

  /**
   * The message was received from somewhere else.
   */
  RECV: 'RECV',
};

/**
 * Create a new message for the given channel from the given JSON value.
 *
 * @param {lib.wam.Channel} channel The channel that received the value.
 * @param {Object} value The value received on the channel.
 */
lib.wam.Message.fromValue = function(channel, value) {
  var msg = new lib.wam.Message();
  msg.channel = channel;
  msg.name = value.name;
  msg.arg = value.arg;
  msg.subject = value.subject || null;
  if (msg.subject)
    msg.isOpen = true;

  msg.regarding = value.regarding || null;
  msg.isFinalReply = (msg.name == 'ok' || msg.name == 'error');
  msg.status = lib.wam.Message.status.RECV;

  return msg;
};

/**
 * This encapsulates the logic of waiting for a message to reply "ready".
 *
 * The "open" message used by channels and entries is an example of a
 * "ready" based reply.  It looks like this...
 *
 *   o--->  open, s:1          # open a thing.
 *   <---o  ready, s:2, re:1   # ok, it's open, reply here to do stuff to it.
 *    ...
 *   o--->  read, s:3, re:2    # thanks, I want to read.
 *   <---o  ok, re:3, final    # ok, here's your data.
 *    ...
 *   o--->  ok, re:2, final    # ok, thanks I'm done.
 *   <---o  ok, re:1, final    # ok, you're done.
 *
 * When open goes wrong, it should look like this...
 *
 *   o--->  open, s:1                 # open a thing.
 *   <---o  error {...}, re:1, final  # Sorry, I won't do that.
 *
 * The "execute" message used by entries also uses ready, and goes like this...
 *
 *   o--->  execute {...}, s:1  # please execute this thing.
 *   <---o  ready, s:2, re:1    # ok, it's starting, reply here to send input.
 *    ...
 *   <---o  strout '...', re:1  # here's some output from that thing.
 *   <---o  strerr '...', re:1  # and some more.
 *   <---o  x {...}, s:3, re:1  # here's some other message about that thing,
 *                              # and this one expects a reply.
 *    ...
 *   o--->  strin '...', re:2   # here's some input for the thing.
 *   o--->  y, re:3, final      # and here's my one-and-only reply to that
 *                              # 'x' message.
 *
 * If the first reply is anything other than "ready" than the onError handler
 * is invoked, the pending message is closed out, and the wait is abandoned.
 *
 * If ready is the first message, then it and all subsequent messages will be
 * passed on to the onReply handler.
 *
 * If the ready message is open (waiting for replies from our end), and the
 * incoming message is the final reply, then we'll close the ready message.
 *
 * This will also close the parent message on the final reply.
 *
 * @param {function(lib.wam.Message)} onReply The function to invoke for
 *     reply.  This includes the initial 'ready' message, and the 'ok' or
 *     'error' message that eventually ends the handshake.
 *     If 'ready' is not received, this function will not be invoked.
 * @param {function(lib.wam.Message)} onError The function to invoke if
 *     the first reply is not 'ready'.  If this function is called, onReply
 *     will not be.  It is called only once if it is called at all.
 *
 * @return {function(lib.wam.Message)} A function that can be used as the
 *     onReply callback of a message send.
 */
lib.wam.Message.waitReady = function(onReply, onError) {

  // Local copy of the inbound 'ready' message.
  var readyMsg = null;

  // Return a function that can be used as the onReply callback for a message
  // send.
  return function(msg) {
    // The parent of the inbound reply is the message that used this function
    // as its onReply callback.  When we get the 'ready' reply, we remember it
    // so we can use it in subsequent messages.
    if (!readyMsg) {
      // If there is no readyMessage, then we haven't heard 'ready' yet.
      if (msg.name == 'ready') {
        // Ok, there it is, make a note of it and pass it through.
        readyMsg = msg;
        onReply(msg);
      } else {
        // If the first reply is something other than 'ready', that's a
        // problem.  We're done talking to you.
        msg.parent.close();
        onError(msg);
      }

    } else {
      if (msg.name == 'ready') {
        // Guarantee that the caller never sees more than one 'ready' message.
        console.warn('Dropping extra ready message');
      } else {
        onReply(msg);
      }
    }

    if (msg.isFinalReply) {
      if (readyMsg && readyMsg.isOpen) {
        // If the ready message was not already closed by someone else,
        // then we'll take care of that.
        readyMsg.closeOk(null);
      }

      if (msg.parent.isOpen)
        msg.parent.close();
    }
  };
};

/**
 * Package up the current message for sending.
 *
 * This will normalize the object state and return a JSON value representing the
 * message state.
 *
 * @return {Object} A serializable object representing this message.
 */
lib.wam.Message.prototype.prepareSend = function() {
  if (this.status != lib.wam.Message.status.INIT)
    throw new Error('Invalid message status: ' + this.status);

  this.status = lib.wam.Message.status.SENT;

  if (this.onReply && !this.subject)
    this.subject = lib.wam.guid();

  var value = {
    name: this.name,
    arg: this.arg,
  };

  if (this.subject) {
    this.isOpen = true;
    value.subject = this.subject;
  }

  if (this.regarding)
    value.regarding = this.regarding;

  return value;
}

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
lib.wam.Message.prototype.dispatch = function(obj, handlers) {
  if (this.status != lib.wam.Message.status.RECV)
    throw 'Invalid message status: ' + this.status;

  var name = this.name;

  if (this.isFinalReply) {
    if (this.parent.isOpen)
      this.parent.close();
  }

  if (!handlers.hasOwnProperty(this.name)) {
    if (this.isFinalReply && (this.name == 'ok' || this.name == 'error')) {
      return true;
    }

    if (handlers.hasOwnProperty('__unknown__')) {
      name = '__unknown__';
    } else {
      console.log('Unknown Message: ' + name);
      if (this.isOpen)
        this.closeError(lib.wam.error.UNEXPECTED_MESSAGE, name);

      return false;
    }
  }

  handlers[name].call(obj, this);
  return true;
};

/**
 * Send this message.
 */
lib.wam.Message.prototype.send = function() {
  this.channel.sendMessage(this);
  return this;
};

/**
 * Internal utility function to create replies.
 *
 * @param {string} name The name of the reply message.
 * @param {*} arg The argument for the reply message.
 * @param {function(lib.wam.Message)} opt_onReply Optional callback for replies
 *     to the reply.
 *
 * @return {lib.wam.Message} A message object representing the reply.
 */
lib.wam.Message.prototype.createReply_ = function(name, arg, opt_onReply) {
  if (!this.status == lib.wam.Message.status.RECV)
    throw new Error('Invalid message status: ' + this.status);

  if (!this.subject)
    throw new Error('This message is not expecting replies');

  if (!this.isOpen)
    throw new Error('Replies to this message have been closed');

  if (opt_onReply && typeof opt_onReply != 'function')
    throw new Error('Invalid onReply: ' + opt_onReply);

  var msg = new lib.wam.Message(this.channel);
  msg.name = name;
  msg.arg = arg;
  msg.regarding = this.subject;

  msg.isFinalReply = (name == 'ok' || name == 'error');

  msg.onReply = opt_onReply;

  return msg;
};

/**
 * This makes a copy of the given message and sends it as if it were a reply
 * to the current message.
 *
 * Any replies to the forwarded message are copied and sent as replies to the
 * given message.  This works over arbitrarily deep replies to the forwarded
 * message.
 */
lib.wam.Message.prototype.forward = function(inMsg) {
  if (inMsg.isFinalReply) {
    this.isOpen = false;
    inMsg.parent.close();
  }

  var outMsg = new lib.wam.Message(this.channel);
  outMsg.regarding = this.subject;

  outMsg.name = inMsg.name;
  outMsg.arg = inMsg.arg;

  if (inMsg.subject)
    outMsg.onReply = inMsg.forward.bind(inMsg);

  outMsg.send();
};

/**
 * Send a reply, and wait for the other end to reply 'ready'.
 *
 * See lib.wam.Message.waitReady.
 *
 * @param {string} name The name of the outbound reply message.
 * @param {*} arg The argument of the outbound reply message.
 * @param {function(lib.wam.Message)} onReply The function to invoke for
 *     reply.  This includes the initial 'ready' message, and the 'ok' or
 *     'error' message that eventually ends the handshake.
 *     If 'ready' is not received, this function will not be invoked.
 * @param {function(lib.wam.Message)} onError The function to invoke if
 *     the first reply is not 'ready'.  If this function is called, onReply
 *     will not be.  It is called only once if it is called at all.
 */
lib.wam.Message.prototype.waitReady = function(name, arg, onReply, onError) {
  return this.reply(name, arg, lib.wam.Message.waitReady(onReply, onError))
};

/**
 * Reply 'ready' to a message.
 *
 * This ties the lifetime of our 'ready' reply to the lifetime of this message.
 *
 * Replies to the 'ready' message are available via the lib.Event stored on
 * meta.onInput of the returned message.
 *
 * @param {*} arg The argument to the outbound 'ready' message.
 *
 * @return {lib.wam.Message} The outbound 'ready' message.
 */
lib.wam.Message.prototype.replyReady = function(arg) {
  var onInput = new lib.Event(function(msg) {
      if (msg.isFinalReply) {
        readyMsg.close();
      } else if (onInput.observers.length == 0) {
        console.warn('Unobserved ready reply: ' + msg.name);
      }
    });

  var readyMsg = this.reply('ready', arg, onInput);

  this.meta.onInput = onInput;

  readyMsg.onClose.addListener(function() {
      if (this.isOpen)
        this.closeOk(null);
    }.bind(this));

  this.onClose.addListener(function() {
      setTimeout(function() {
          // The caller gets 10s to close out the ready message in a controlled
          // manner.  If the timeout expires, we drop our end by force.
          if (readyMsg.isOpen) {
            // The tests trigger this path when testing unexpected loss of
            // the transport.  Rather than log a misleading message, we skip
            // it for now.
            // console.warn('Ready message close timeout.')
            readyMsg.forceClose();
          }
        }, 10000);
    });


  return readyMsg;
};

/**
 * Simple reply, possibly one of many.
 *
 * @param {string} name The name of the outbound message.
 * @param {*} arg The argument of the outbound message.
 * @param {function(lib.wam.Message)} opt_onReply Optional callback for replies.
 *
 * @return {lib.wam.Message} The outbound message.
 */
lib.wam.Message.prototype.reply = function(name, arg, opt_onReply) {
  var msg = this.createReply_(name, arg, opt_onReply);
  return msg.send();
};

/**
 * String reply, possibly one of many.
 *
 * This is analogous to stdout.
 *
 * @param {string} arg The string to send.
 * @param {function(lib.wam.Message)} opt_onReply Optional callback when the
 *     message is received.
 *
 * @return {lib.wam.Message} The outbound message.
 */
lib.wam.Message.prototype.strout = function(arg, opt_onReply) {
  var msg = this.createReply_('strout', arg, opt_onReply);
  return msg.send();
};


/**
 * String error reply, possibly one of many.
 *
 * This is analogous to stderr.
 *
 * @param {string} arg The string to send.
 * @param {function(lib.wam.Message)} opt_onReply Optional callback when the
 *     message is received.
 *
 * @return {lib.wam.Message} The outbound message.
 */
lib.wam.Message.prototype.strerr = function(arg, opt_onReply) {
  var msg = this.createReply_('strerr', arg, opt_onReply);
  return msg.send();
};

/**
 * Reply with a message named 'error', marked as the last reply.
 *
 * Used to indicate that something went wrong, and you're done replying.
 *
 * @param {string} name The name of the outbound 'error' message.
 * @param {*} arg The argument of the outbound 'error' message.
 * @param {function(lib.wam.Message)} opt_onReply Optional callback for replies.
 *
 * @return {lib.wam.Message} The outbound message.
 */
lib.wam.Message.prototype.closeError = function(name, arg, opt_onReply) {
  if (this.channel.isConnected) {
    var msg = this.createReply_('error', {name: name, arg: arg}, opt_onReply);
    msg.send();
  } else {
    console.log('closeError on disconnected channel.');
  }

  this.onClose();
  this.isOpen = false;
  return msg;
};

/**
 * Reply with a message named 'ok', marked as the last reply.
 *
 * Used to indicate that you're done replying, and everything went at least
 * as well as expected.
 *
 * @param {*} arg The argument of the outbound 'ok' message.
 * @param {function(lib.wam.Message)} opt_onReply Optional callback for replies.
 *
 * @return {lib.wam.Message} The outbound message.
 */
lib.wam.Message.prototype.closeOk = function(arg, opt_onReply) {
  if (this.channel.isConnected) {
    var msg = this.createReply_('ok', arg, opt_onReply);
    msg.send();
  } else {
    // This happens when trying to clean up after unexpected disconnects.
    // console.log('closeOk on disconnected channel.');
  }

  this.onClose();
  this.isOpen = false;
  return msg;

};

/**
 * Close a message that we sent.
 *
 * This doesn't cause an actual message to be sent, it ensures that the
 * last-reply has been received, or cleans up if it has not.
 *
 * See also lib.wam.Message..close().
 */
lib.wam.Message.prototype.forceClose = function() {
  if (this.status != lib.wam.Message.status.SENT)
    throw 'Invalid message status: ' + this.status;

  delete this.channel.openMessages[this.subject];

  if (this.isOpen) {
    this.isOpen = false;
    this.onClose();
  } else {
    this.closeStack_.push(lib.f.getStack());
    console.warn(this.channel.name + ': Double close for: ' + this.subject);
    console.log(this.closeStack_);
  }
};

/**
 * Close a message that we sent.
 *
 * This has the same effect as forceClose, except it logs a warning if the
 * message is still open.
 *
 * This is here only to ensure that you and the sender agree on when the
 * final reply is expected.  If you don't use it, you'll see a "Parent was not
 * closed" message in the JS Console, sourced from lib.wam.Channel..onMessage_.
 */
lib.wam.Message.prototype.close = function() {
  if (this.subject in this.channel.openMessages) {
    console.warn('Abandoning replies for: ' + this.subject);
    console.log(lib.f.getStack());
    console.log(this);
  }

  this.forceClose();
};
