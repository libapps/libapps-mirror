// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * wam.Channel directs messages to a companion instance of wam.Channel
 * on the other side of an abstract "transport".
 *
 * @param {Object} A transport object.  See wam.DirectTransport and
 *     wam.ChromePortTransport for the de-facto interface.
 */
wam.Channel = function(transport, opt_name) {
  transport.readyBinding.assertReady();

  this.transport_ = transport;
  this.transport_.onMessage.addListener(this.onTransportMessage_, this);
  this.transport_.readyBinding.onClose.addListener(
      this.onTransportClose_, this);
  this.transport_.readyBinding.onReady.addListener(
      this.onTransportReady_, this);

  this.readyBinding = new wam.binding.Ready();
  this.readyBinding.onClose.addListener(this.onReadyBindingClose_, this);

  if (this.transport_.readyBinding.isReadyState('READY'))
    this.readyBinding.ready();

  /**
   * Called when the remote end requests a handshake.
   *
   * The event handler will be passed a wam.ReadyResponse, and should
   * call its replyReady method to accept the handshake.  Use the closeError
   * method to reject the handshake with a specific reason, or do nothing and
   * the handshake will be fail by default with a wam.Error.HandshakeDeclined
   * error.
   *
   * By the time this event is invoked the channel has already checked the
   * channelProtocol name and version.
   */
  this.onHandshakeOffered = new wam.Event();

  /**
   * Messages we sent that are expecting replies, keyed by message subject.
   */
  this.openOutMessages_ = {};

  /**
   * Bitfield of verbosity.
   */
  this.verbose = wam.Channel.verbosity.NONE;

  /**
   * Name to include as a prefix in verbose logs.
   */
  this.name = opt_name || 'ch-' + (wam.Channel.nameSequence_++).toString(16);
};

wam.Channel.verbosity = {
  /**
   * Log nothing.  (Assign to wam.Channel..verbose, rather than bitwise OR.)
   */
  'NONE': 0x00,

  /**
   * Log messages sent from this channel.
   */
  'OUT': 0x01,

  /**
   * Log messages received by this channel.
   */
  'IN': 0x02,

  /**
   * Log synthetic messages that appear on this channel.
   */
  'SYNTHETIC': 0x04,

  /**
   * Log all of the above.
   */
  'ALL': 0x0f
};

wam.Channel.nameSequence_ = 0;

/**
 * Shared during the handshake message.
 */
wam.Channel.protocolName = 'x.wam.Channel';

/**
 * Shared during the handshake message.
 */
wam.Channel.protocolVersion = '1.0';

/**
 * Return a summary of the given message for logging purposes.
 */
wam.Channel.prototype.summarize_ = function(message) {
  var rv = message.name;

  if (message.subject)
    rv += '@' + message.subject.substr(0, 5);

  if (message.regardingSubject) {
    rv += ', re:';
    if (message.regardingMessage) {
      rv += message.regardingMessage.name + '@';
    } else {
      rv += '???@';
    }
    rv += message.regardingSubject.substr(0, 5);
  }


  return rv;
};

wam.Channel.prototype.reconnect = function() {
  if (this.transport_.readyBinding.isReadyState('READY'))
    this.transport_.readyBinding.closeOk(null);

  this.readyBinding.reset();
  this.transport_.reconnect();
};

wam.Channel.prototype.disconnect = function(diagnostic) {
  var outMessage = new wam.OutMessage(
      this, 'disconnect', {diagnostic: diagnostic});

  outMessage.onSend.addListener(function() {
      if (this.readyBinding.isOpen)
        this.readyBinding.closeOk(null);
    }.bind(this));

  outMessage.send();
};

/**
 * Send a message across the channel.
 *
 * This method should only be called by wam.OutMessage..send().  Don't call
 * it directly or you'll miss out on the bookkeeping from OutMessage..send().
 *
 * @param {wam.OutMessage} outMessage The message to send.
 * @param {function()} opt_onSend Optional callback to invoke after the message
 *     is actually sent.
 */
wam.Channel.prototype.sendMessage = function(outMessage, opt_onSend) {
  if (this.verbose & wam.Channel.verbosity.OUT) {
    console.log(this.name + '/OUT: ' + this.summarize_(outMessage) +
                ',', outMessage.arg);
  }

  this.transport_.send(outMessage.toValue(), opt_onSend);
};

/**
 * Send a value to this channel as if it came from the remote.
 *
 * This is used to cleanly close out open messages in the event that we lose
 * contact with the remote, or they neglect to send a required final reply.
 */
wam.Channel.prototype.injectMessage = function(
    name, arg, opt_regardingSubject) {

  var inMessage = new wam.InMessage(
      this, {name: name, arg: arg, regarding: opt_regardingSubject});
  inMessage.isSynthetic = true;

  wam.setImmediate(this.routeMessage_.bind(this, inMessage));

  return inMessage;
};

/**
 * Create the argument for a handshake message.
 *
 * @param {*} payload Any "transportable" value.  This is sent to the remote end
 *     to help it decide whether or not to accept the handshake, and how to
 *     deal with subsequent messages.  The current implementation expects a
 *     `null` payload, and assumes that means you want to talk directly to
 *     a wam.fs.Directory.
 * @return {wam.ReadyRequest}
 */
wam.Channel.prototype.createHandshakeMessage = function(payload) {
  return new wam.OutMessage
  (this, 'handshake',
   { channelProtocol: {
       name: wam.Channel.protocolName,
       version: wam.Channel.protocolVersion
     },
     payload: payload
   });
};

wam.Channel.prototype.cleanup = function() {
  // Construct synthetic 'error' messages to close out any orphans.
  for (var subject in this.openOutMessages_) {
    this.injectMessage('error',
                       wam.mkerr('wam.Error.ChannelDisconnect',
                                 ['Channel cleanup']),
                       subject);
  }
};

/**
 * Register an OutMessage that is expecting replies.
 *
 * Any incoming messages that are 'regarding' the outMessage.subject will
 * be routed to the onReply event of outMessage.
 *
 * When the message is closed it will automatically be unregistered.
 *
 * @param {wam.OutMessage} The message to mark as open.
 */
wam.Channel.prototype.registerOpenOutMessage = function(outMessage) {
  var subject = outMessage.subject;

  if (!outMessage.isOpen || !subject)
    throw new Error('Message has no subject.');

  if (subject in this.openOutMessages_)
    throw new Error('Subject already open: ' + subject);

  outMessage.onClose.addListener(function() {
      if (!(subject in this.openOutMessages_))
        throw new Error('OutMessage not found.');

      delete this.openOutMessages_[subject];
    }.bind(this));

  this.openOutMessages_[subject] = outMessage;
};

/**
 * Return the opened message associated with the given subject.
 *
 * @return {wam.OutMessage} The open message.
 */
wam.Channel.prototype.getOpenOutMessage = function(subject) {
  if (!(subject in this.openOutMessages_))
    return null;

  return this.openOutMessages_[subject];
};

/**
 * Route an incoming message to the correct onReply or channel message handler.
 */
wam.Channel.prototype.routeMessage_ = function(inMessage) {
  if ((this.verbose & wam.Channel.verbosity.IN) ||
      (inMessage.isSynthetic &&
       this.verbose & wam.Channel.verbosity.SYNTHETIC)) {
    console.log(this.name + '/' + (inMessage.isSynthetic ? 'SYN: ' : 'IN: ') +
                this.summarize_(inMessage) +
                ',', inMessage.arg);
  }

  if (inMessage.regardingSubject) {
    if (!inMessage.regardingMessage) {
      // The message has a regardingSubject, but no corresponding
      // regardingMessage was found.  That's a problem.
      console.warn(this.name + ': Got message for unknown subject: ' +
                   inMessage.regardingSubject);
      console.log(inMessage);

      if (inMessage.isOpen)
        inMessage.replyError('wam.Error.UnknownSubject', [inMessage.subject]);
      return;
    }

    try {
      inMessage.regardingMessage.onReply(inMessage);
    } catch(ex) {
      console.error('onReply raised exception: ' + ex, ex.stack);
    }

    if (inMessage.isFinalReply) {
      if (!inMessage.regardingMessage.isOpen) {
        console.warn(this.name + ': Outbound closed a regardingMessage that ' +
                   'isn\'t open: outbound: ' +
                   inMessage.regardingMessage.name + '/' +
                   inMessage.regardingSubject + ', ' +
                   'final reply: ' + inMessage.name + '/' + inMessage.subject);
      }

      inMessage.regardingMessage.onClose();
    }

  } else {
    console.log
    inMessage.dispatch(this, wam.Channel.on);
  }
};

wam.Channel.prototype.onReadyBindingClose_ = function(reason, value) {
  this.cleanup();
};

/**
 * Handle a raw message from the transport object.
 */
wam.Channel.prototype.onTransportMessage_ = function(value) {
  this.routeMessage_(new wam.InMessage(this, value));
};

wam.Channel.prototype.onTransportReady_ = function() {
  this.readyBinding.ready();
};

/**
 * Handler for transport disconnects.
 */
wam.Channel.prototype.onTransportClose_ = function() {
  if (!this.readyBinding.isOpen)
    return;

  this.readyBinding.closeError('wam.Error.TransportDisconnect',
                               ['Unexpected transport disconnect.']);
};

/**
 * Message handlers, bound to a wam.Channel instance in the constructor.
 *
 * These functions are invoked with an instance of wam.fs.Channel
 * as `this`, in response to some inbound wam.Message.
 */
wam.Channel.on = {};

/**
 * Remote end initiated a disconnect.
 */
wam.Channel.on['disconnect'] = function(inMessage) {
  this.readyBinding.closeError('wam.Error.ChannelDisconnect',
                               [inMessage.arg.diagnostic]);
};

/**
 * Remote end is offering a handshake.
 */
wam.Channel.on['handshake'] = function(inMessage) {
  if (inMessage.arg.channelProtocol.name != wam.Channel.protocolName) {
    inMessage.replyError('wam.Error.InvalidChannelProtocol',
                         [inMessage.arg.channelProtocol.name]);
    return;
  }

  if (inMessage.arg.channelProtocol.version !=
      wam.Channel.protocolVersion) {
    inMessage.replyError('wam.Error.InvalidChannelVersion',
                         [inMessage.arg.channelProtocol.version]);
    return;
  }

  var offerEvent = {
    inMessage: inMessage,
    response: null
  };

  this.onHandshakeOffered(offerEvent);

  if (!offerEvent.response) {
    inMessage.replyError('wam.Error.HandshakeDeclined',
                         ['Declined by default.']);
  }
};
