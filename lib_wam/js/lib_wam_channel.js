// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.Event');

/**
 * lib.wam.Channel directs messages to a companion instance of lib.wam.Channel
 * on the other side of an abstract "transport".
 *
 *                      [application-code]
 *
 *                [message]    ^ ^          ^
 *                   |         |:|          |
 *                   |         |:|          |
 *                   |         |:|          |
 *            +-------------------------------------+
 *            |               channel               |
 *            |                                     |
 *            :============= transport =============:
 *            |                                     |
 *            |               channel               |
 *            +-------------------------------------+
 *                   |         |:|          |
 *                   |         |:|          |
 *                   |     [reply 1]        |
 *                   |      [reply .]       |
 *                   v       [reply n]  [message]
 *
 *                      [application-code]
 *
 *
 * (See lib.wam.Message for the implementation of the message class.)
 *
 * The transport typically moves messages between two web origins, though
 * the in-process transport can sometimes be useful too.
 *
 * NOTE(rginda): Only the in-process (lib.wam.DirectTransport) and
 *   chrome.runtime.Port (lib.wam.ChromePortTransport) transports are
 *   implemented.  In theory Web Worker, HTML5 MessagePort, or even
 *   WebSocket based transports are easy to add.
 *
 * Every message will have properties called 'name' and 'arg' (short for
 * 'argument').  The 'name' is always a string, and identifies the
 * message.  The 'arg' can be any serializable JavaScript value.  Its contents
 * are implied by the message name and the context in which it was received.
 *
 * "On the wire", messages look like this...
 *
 *     {name: 'strout', ..., arg: 'hello world'}
 *   or...
 *     {name: 'ok', ..., arg: {type: 'EXE}}
 *   or...
 *     {name: 'ok', ..., arg: null}
 *
 * Though application code will usually just call lib.wam.Channel..send()...
 *
 *     var channel = new lib.wam.Channel(transport);
 *
 *     channel.send('strout', 'hello world');
 *     channel.send('ok', {type: 'EXE'});
*
 * Messages that require replies also include a 'subject'.  This is a
 * string that uniquely identifies the message on the channel.  Subjects
 * must not be re-used during the lifetime of the channel.
 *
 *     {name: 'open', subject: S1, ..., arg: {path: '/'}}
 *
 * Application code generally doesn't need to worry about the 'subject'
 * property.  When the optional onReply handler is provided to
 * lib.wam.Channel..send(), a message subject will be generated.
 *
 *     channel.send('open', {path: '/'}, function(msg) { ... });
 *
 * NOTE(rginda): There was a time when I thought subjects needed to be
 *   globally unique.  The current implementation doesn't require that, though
 *   we still generate subjects as guids.  A simple sequence may be enough.
 *
 * If you receive a message with a subject you are REQUIRED to reply.  Replies
 * should have a property called "regarding" that identifies the original
 * subject.  You may send multiple replies, and your replies may themselves
 * request replies.
 *
 *     {name: 'ready', regarding: S1, ...,
 *      arg: null}
 *   or...
 *     {name: 'ready', subject: S2, regarding: S1, ...,
 *      arg: null}
 *
 * Application code generally replies using the reply(), closeOk(), and
 * closeError() methods of lib.wam.Message.  These methods handle the
 * 'regarding' property so that application code doesn't need to get into the
 * details.
 *
 *     lib.wam.Directory.on['open'] = function(msg) {
 *         ...
 *         msg.reply('ready', null);
 *     };
 *
 * Your final reply should be named 'ok' or 'error', and include the
 * 'isFinalReply' property set to true.
 *
 *     {name: 'ok', regarding: S1, isFinalReply: true,
 *      arg: null}
 *   or...
 *     {name: 'error', regarding: S1, isFinalReply: true,
 *      arg: {name: 'NOT_FOUND', arg: '/'}}
 *
 * Application code can send final replies using the closeOk or closeError
 * methods of lib.wam.Message...
 *
 *     msg.closeOk(null);
 *   or...
 *     msg.closeError(lib.wam.error.NOT_FOUND, '/');
 *
 * The lib.wam.Channel object keeps track of outbound messages so that the
 * appropriate callback can be invoked when a reply is received.  If a
 * recipient forgets to send a final-reply, this callback will be leaked.
 *
 * If the channel is disconnected while there are pending messages, each
 * will receive a synthetic final-reply indicating that the connection was
 * lost.
 *
 *   {name: 'error', regarding: <your-subject>
 *    arg: {name: 'CHANNEL_DISCONNECT', arg: <channel-name>}}
 *
 * After a transport is established and given to a new lib.wam.Channel
 * instance one or both parties may initiate a handshake.  The 'handshake'
 * message establishes a context for subsequent communication.
 *
 * Either end of the connection may abort the handshake if detects a problem.
 *
 * A handshake looks like this...
 *
 * 1. We offer a handshake.
 *  LOCAL                                                        REMOTE
 *  o----------------------------------------------------------------->
 *   {name: 'handshake', subject: s1,
 *    arg: {channelProtocol: {name: string, version: string},
 *          payload: value}
 *   }
 *
 * 2a. REMOTE accepts the offer.
 *  LOCAL                                                        REMOTE
 *  <-----------------------------------------------------------------o
 *   {name: 'ready', subject: s2, regarding: s1,
 *    arg: {channelProtocol: {name: string, version: string},
 *          payload: value}
 *   }
 *
 * 3a. The Handshake is now established.  LOCAL should send subsequent messages
 *    as replies to subject s2.  REMOTE may continue to send subsequent
 *    messages as replies to subject s1.  If either end sends a final-reply
 *    the handshake is shut down.
 *
 * Optionally, REMOTE could decline the handshake in step 2 with a message
 * like...
 *
 * 2b. REMOTE rejects the offer.
 *  LOCAL                                                        REMOTE
 *  <-----------------------------------------------------------------o
 *   {name: 'error', regarding: s1, isFinalReply: true,
 *    arg: {name: string, arg: value}
 *   }
 *
 * Once a handshake is completed, the application code may send whatever
 * messages are implied by the handshake payload.  In the current code, the
 * handshake payload is always `null`, and that implies that the remote end
 * will dispatch all messages to a lib.wam.fs.Directory representing the root
 * of the exported filesystem.
 *
 * The only other message that can be sent over a raw channel is 'disconnect',
 * which terminates the connection and all active handshakes, and provides a
 * reason for the disconnect. See the disconnect() method for more information.
 *
 * @param {Object} A transport object.  See lib.wam.DirectTransport and
 *     lib.wam.ChromePortTransport for the de-facto interface.
 */
lib.wam.Channel = function(transport) {
  if (!transport.isConnected)
    throw new Error('Transport is not connected.');

  this.transport_ = transport;
  this.transport_.onMessage.addListener(this.onMessage_, this);
  this.transport_.onDisconnect.addListener(this.onTransportDisconnect_, this);

  /**
   * @type {boolean}
   */
  this.isConnected = true;

  /**
   * Called when the channel is disconnected, even if you asked for the
   * disconnection.
   *
   * @type {lib.Event}
   */
  this.onDisconnect = new lib.Event(this.onDisconnect_.bind(this));

  /**
   * Called when we accept a handshake offered by the other end.
   *
   * The event will receive two parameters, handshakeMessage and readyMessage.
   *
   * The handshakeMessage is inbound 'handshake' message, you can reply
   * to this to send additional messages within the context of this handshake,
   * or to close out the handshake.
   *
   * The readyMessage is the message we sent out acknowledging the handshake
   * offer.  The remote end may reply to this message to send additional
   * messages within the context of this handshake, or to close out the
   * handshake.
   *
   * @type {lib.Event}
   */
  this.onHandshakeAccept = new lib.Event();


  /**
   * Called when we accept a handshake offered by the other end.
   *
   * The event will receive two parameters, handshakeMessage and rejectMessage,
   * with similar meanings to the parameters of onHandshakeAccept.
   */
  this.onHandshakeReject = new lib.Event();

  /**
   * Messages with pending replies, keyed by message subject.
   */
  this.openMessages = {};

  /**
   * True if we should log send/receive activity.
   */
  this.verbose = false;

  /**
   * Name to include as a prefix in verbose logs.
   */
  this.name = 'unk';
};

/**
 * Shared during the handshake message.
 */
lib.wam.Channel.protocolName = 'lib.wam.Channel';

/**
 * Sources that could be responsible for a disconnect.
 */
lib.wam.Channel.source = {
  LOCAL: 'local',
  REMOTE: 'remote',
  TRANSPORT: 'transport'
};

/**
 * Shared during the handshake message.
 */
lib.wam.Channel.protocolVersion = '1.0';

/**
 * Send an existing lib.wam.Message across the channel.
 *
 * @param {lib.wam.Message} msg The message to send.
 */
lib.wam.Channel.prototype.sendMessage = function(msg) {
  var value = msg.prepareSend();

  if (msg.onReply)
    this.openMessages[msg.subject] = msg;

  if (this.verbose)
    console.log('SEND: ' + this.name + ': ' + JSON.stringify(value));

  this.transport_.send(value);
};

/**
 * Initiate a handshake with the remote end.
 *
 * Only one of onReply and onError will be called.  If onError is called, it
 * will be called exactly once.
 *
 * @param {*} payload Any serializable value.  This is sent to the remote end
 *     to help it decide whether or not to accept the handshake, and how to
 *     deal with subsequent messages.  The current implementation expects a
 *     `null` payload, and assumes that means you want to talk directly to
 *     a lib.wam.fs.Directory.
 * @param {function(lib.wam.Message)} onReply A function to invoke for EVERY
 *     reply.  This includes the initial 'ready' message, and the 'ok' or
 *     'error' message that eventually ends the handshake.
 *     If the handshake does not succeed, this method will not be invoked.
 * @param {function(lib.wam.Message)} onError A function to invoke if the
 *     handshake fails due to the remote sending anything other than 'ready'
 *     as the first message.
 */
lib.wam.Channel.prototype.offerHandshake = function(
    payload, onReply, onError) {
  return this.waitReady
  ('handshake',
   { channelProtocol: {
       name: lib.wam.Channel.protocolName,
       version: lib.wam.Channel.protocolVersion
     },
     payload: payload
   },
   onReply,
   onError);
};

/**
 * Called when we're offered a handshake or when our handshake offer has been
 * accepted.
 *
 * NOTE(rginda): An earlier design used custom handshake payloads.  At the
 *   moment we only use `null` as the handshake payload, and that implies we're
 *   going to be talking directly to lib.wam.fs.Directory..dispatchMessage of
 *   whatever root directory the recipient wants to publish.
 *
 * You may overwrite this method if you want to customize the handling of
 * handshake payload.  The default implementation expects payload === null.
 *
 * When this channel has been offered a handshake, you can examine the offer and
 * return true to accept the handshake, false to refuse it, or null if you wish
 * to delay the decision.
 *
 * If you return null it's your responsibility to call acceptHandshake or
 * rejectHandshake to complete your end of the handshake process.
 *
 * @param {lib.wam.Message} msg The inbound handshake offer message.
 *
 * @return {boolean} The result.
 */
lib.wam.Channel.prototype.validateHandshakePayload = function(msg) {
  return msg.arg.payload === null;
};

/**
 * Accept the handshake being offered.
 *
 * This accepts the offered handshake by replying with a 'ready' message.
 * The handshake offer message will gain a meta.onInput event (see
 * lib.wam.Message..replyReady) which you can subscribe to in order to
 * receive further inbound messages relating to the handshake offer.
 *
 * @param {Object} msg The message containing the handshake offer.
 * @param {*} payload An arbitrary payload to include in our 'ready' message.
 */
lib.wam.Channel.prototype.acceptHandshake = function(hsMsg, payload) {
  var readyMsg = hsMsg.replyReady({payload: payload});
  this.onHandshakeAccept(hsMsg, readyMsg);
};

/**
 * Reject the handshake being offered.
 *
 * @param {Object} msg The message containing the handshake offer.
 * @param {string} opt_reason An optional human-readable string explaining
 *     the reason for the rejection.
 */
lib.wam.Channel.prototype.rejectHandshake = function(hsMsg, opt_reason) {
  var reason = opt_reason || 'Handshake rejected.';
  var rejectMsg = hsMsg.closeError(lib.wam.error.HANDSHAKE_REJECTED, reason);
  this.onHandshakeReject(hsMsg, rejectMsg);
};

/**
 * A wrapper around send() which waits for a reply named 'ready'.
 *
 * See lib.wam.Message.waitReady for details.
 *
 * @param {string} name The name of the message to send.
 * @param {*} arg The argument for the outbound message.
 * @param {function(lib.wam.Message)} onReply The function to invoke for
 *     reply.  This includes the initial 'ready' message, and the 'ok' or
 *     'error' message that eventually ends the handshake.
 *     If 'ready' is not received, this function will not be invoked.
 * @param {function(lib.wam.Message)} onError The function to invoke if
 *     the first reply is not 'ready'.  If this function is called, onReply
 *     will not be.  It is called only once if it is called at all.
 *
 * @return {lib.wam.Message} The outbound message.
 */
lib.wam.Channel.prototype.waitReady = function(name, arg, onReply, onError) {
  return this.send(name, arg, lib.wam.Message.waitReady(onReply, onError));
};

/**
 * Construct a new lib.wam.Message with the given name, arg, and reply handler,
 * and send it across the channel.
 *
 * Returns the new lib.wam.Message.
 *
 * @param {string} name The name of the message to send.
 * @param {*} arg Any JSON serializable object to pass as an argument.
 * @param {function()} opt_onReply Optional callback to handle replies.  If
 *     provided, then the caller may send 0 or more 'reply' messages, and
 *     *must* send exactly one 'reply-close' message.
 *
 * @return {lib.wam.Message} The newly constructed message.
 */
lib.wam.Channel.prototype.send = function(name, arg, opt_onReply) {
  var msg = new lib.wam.Message(this);
  msg.name = name;
  msg.arg = arg;
  msg.onReply = opt_onReply;

  this.sendMessage(msg);

  return msg;
};

/**
 * Initiate a disconnect.
 *
 * This should only be called by client code that intends to cause a disconnect.
 * It should never be called in reaction to a disconnect.
 *
 * @param {*} arg The argument to send with the 'disconnect' message.
 */
lib.wam.Channel.prototype.disconnect = function(arg) {
  if (!this.isConnected) {
    console.warn(this.name + ': Already disconnected: ', lib.f.getStack());
    return;
  }

  if (!this.transport_.isConnected) {
    this.isConnected = false;
    return;
  }

  this.send('disconnect', arg);
  this.onDisconnect(lib.wam.Channel.source.LOCAL, arg);
  this.isConnected = false;

  // TODO(rginda): Guarantee the send happens before the transport disconnect?
  setTimeout(this.transport_.disconnect.bind(this.transport_), 2000);
};

/**
 * Handle a raw message from the transport object.
 */
lib.wam.Channel.prototype.onMessage_ = function(value) {
  if (this.verbose)
    console.log('RECV: ' + this.name + ': ' + JSON.stringify(value));

  var msg = lib.wam.Message.fromValue(this, value);

  if (msg.regarding) {
    if (!(msg.regarding in this.openMessages)) {
      if (msg.subject)
        msg.closeError(lib.wam.error.UNKNOWN_SUBJECT, msg.subject);

      console.warn('Got message for unknown subject: ' + msg.regarding);
      console.log(msg);
      return;
    }

    msg.parent = this.openMessages[msg.regarding];

    if (msg.isFinalReply)
      delete this.openMessages[msg.regarding];

    msg.parent.onReply(msg);

    if (msg.isFinalReply && msg.parent.isOpen) {
      console.warn(this.name + ': Parent was not closed: ' +
                   msg.parent.subject);
      msg.parent.close();
    }
  } else {
    msg.dispatch(this, lib.wam.Channel.on);
  }
};

/**
 * Internal bookkeeping for disconnect events.
 */
lib.wam.Channel.prototype.onDisconnect_ = function(source, arg) {
  this.isConnected = false;

  // Construct synthetic close messages for any orphans.
  for (var subject in this.openMessages) {
    var value = {
      name: 'error',
      arg: {name: lib.wam.error.CHANNEL_DISCONNECT, arg: this.name},
      isFinalReply: true,
      regarding: subject
    };
    this.onMessage_(value);
  }
};

/**
 * Handler for transport disconnects.
 */
lib.wam.Channel.prototype.onTransportDisconnect_ = function() {
  if (!this.isConnected)
    return;

  this.onDisconnect(lib.wam.Channel.source.TRANSPORT,
                    {reason: 'Transport disconnected.'});
};

/**
 * Message handlers, bound to a lib.wam.Channel instance in the constructor.
 *
 * All of these functions are invoked with an instance of lib.wam.fs.Channel
 * as `this`, in response to some inbound lib.wam.Message.
 */
lib.wam.Channel.on = {};

/**
 * Remote end initiated a disconnect.
 */
lib.wam.Channel.on['disconnect'] = function(msg) {
  this.onDisconnect(lib.wam.Channel.source.REMOTE, msg.arg);
};

/**
 * Remote end is offering a handshake.
 */
lib.wam.Channel.on['handshake'] = function(msg) {
  if (msg.arg.channelProtocol.name != lib.wam.Channel.protocolName) {
    this.rejectHandshake(msg, 'Protocol name mismatch, expected: ' +
                         lib.wam.Channel.protocolName +
                         ', got: ' + msg.arg.channelProtocol.name);
    return;
  }

  if (msg.arg.channelProtocol.version != lib.wam.Channel.protocolVersion) {
    this.rejectHandshake(msg, 'Protocol version mismatch, expected: ' +
                         lib.wam.Channel.protocolVersion +
                         ', got: ' + msg.arg.protocolVersion);
    return;
  }

  var rv = this.validateHandshakePayload(msg);
  if (rv == null) {
    // Validate returned null means we're going to delay the validation of the
    // handshake.
    return;
  }

  if (rv) {
    this.acceptHandshake(msg, null);
  } else {
    this.rejectHandshake(msg, 'Handshake validation failed.');
  }
};
