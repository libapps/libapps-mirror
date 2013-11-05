// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.Event');

lib.wa.DirectTransport = function(name) {
  /**
   * An arbitrary name for this transport used for debugging.
   */
  this.name = name;

  this.isConnected = false;

  /**
   * True if we should log inbound messages.
   */
  this.verbose = false;

  this.onDisconnect = new lib.Event(function(e) {
      if (this.verbose)
          console.log(this.name + ' disconnected.');

      this.remoteEnd_ = null;
      this.isConnected = false;
    }.bind(this));

  /**
   * Subscribe to this event to peek at inbound messages.
   */
  this.onMessage = new lib.Event(function(msg) {
      if (this.verbose)
        console.log(this.name + ' got: ' + JSON.stringify(msg));
    }.bind(this));

  this.queue_ = [];
  this.queueTimeout_ = null;
};

/**
 * Create two direct transports, connect them via two channels, and call back
 * post handshake.
 *
 * What could go wrong?
 */
lib.wa.DirectTransport.createChannelPair = function(
    onHandshakeReady, onHandshakeError) {
  var t1 = new lib.wa.DirectTransport();
  var t2 = new lib.wa.DirectTransport();
  t1.connect(t2);

  var channel1 = new lib.wa.Channel(t1);
  var channel2 = new lib.wa.Channel(t2);

  var hsOfferMsg = null;

  channel2.onHandshakeAccept.addListener(function(hsOfferMsg_, readyMsg) {
      hsOfferMsg = hsOfferMsg_;
    });

  channel1.offerHandshake(
      null,
      function onReply(msg) {
        if (msg.name == 'ready')
          onHandshakeReady(hsOfferMsg, msg);
      },
      onHandshakeError);
};

lib.wa.DirectTransport.prototype.service_ = function() {
  this.queueTimeout_ = null;

  while (this.queue_.length) {
    var ary = this.queue_.shift();
    var method = ary[0];
    ary.shift();
    this[method].apply(this, ary);
  }
};

lib.wa.DirectTransport.prototype.push_ = function(name, args) {
  this.queue_.push([name, args]);
  if (!this.queueTimeout_)
    this.queueTimeout_ = setTimeout(this.service_.bind(this), 0);
};

/**
 * Connect this DirectTransport to another DirectTransport.
 *
 * Messages sent to this object will appear on the remote, and vice-versa.
 *
 * You do not need to call the connect() method of the remoteEnd.
 *
 * @param {lib.wa.DirectTransport}
 */
lib.wa.DirectTransport.prototype.connect = function(remoteEnd) {
  if (this.remoteEnd_)
    throw 'Already Connected';

  this.remoteEnd_= remoteEnd;
  remoteEnd.remoteEnd_ = this;

  this.isConnected = remoteEnd.isConnected = true;
};

lib.wa.DirectTransport.prototype.disconnect = function() {
  if (!this.remoteEnd_)
    return;

  this.remoteEnd_.push_('onDisconnect');
  this.remoteEnd_ = null;

  this.onDisconnect();
};

lib.wa.DirectTransport.prototype.send = function(msg) {
  if (!this.remoteEnd_)
    throw new Error('Not connected.');

  this.remoteEnd_.push_('onMessage', msg);
};
