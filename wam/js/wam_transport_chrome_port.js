// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * This is the chrome message port based transport.
 */
wam.transport.ChromePort = function() {
  // The underlying Chrome "platform app" port.
  this.port_ = null;

  this.extensionId_ = null;

  this.readyBinding = new wam.binding.Ready();
  this.readyBinding.onClose.addListener(this.onReadyBindingClose_.bind(this));

  this.onMessage = new wam.Event();
};

wam.transport.ChromePort.prototype.setPort_ = function(port) {
  if (this.port_)
    throw new Error('Port already set');

  this.port_ = port;
  var id = port.sender ? port.sender.id : 'anonymous';

  var thisOnMessage = function(msg) {
    wam.async(this.onMessage, [this, msg]);
  }.bind(this);

  var thisOnDisconnect = function() {
    console.log('wam.transport.ChromePort: disconnect: ' + id);

    this.port_.onMessage.removeListener(thisOnMessage);
    this.port_.onMessage.removeListener(thisOnDisconnect);
    this.port_ = null;
    if (this.readyBinding.isOpen) {
      this.readyBinding.closeError('wam.Error.TransportDisconnect',
                                   ['Transport disconnect.']);
    }
  }.bind(this);

  this.port_.onMessage.addListener(thisOnMessage);
  this.port_.onDisconnect.addListener(thisOnDisconnect);
};

wam.transport.ChromePort.prototype.send = function(value, opt_onSend) {
  this.port_.postMessage(value);
  if (opt_onSend)
    wam.async(opt_onSend);
};

wam.transport.ChromePort.prototype.accept = function(port) {
  this.readyBinding.assertReadyState('WAIT');
  this.setPort_(port);
  this.send('accepted');
  this.readyBinding.ready();
  console.log('wam.transport.ChromePort: accept: ' + port.sender.id);
};

wam.transport.ChromePort.prototype.reconnect = function() {
  if (!this.extensionId_)
    throw new Error('Cannot reconnect.');

  this.readyBinding.reset();
  this.connect(this.extensionId_);
};

wam.transport.ChromePort.prototype.connect = function(extensionId) {
  this.readyBinding.assertReadyState('WAIT');
  this.extensionId_ = extensionId;

  var port = chrome.runtime.connect(
      extensionId, {name: 'x.wam.transport.ChromePort/1.0'});

  if (!port) {
    this.readyBinding.closeError('wam.Error.TransportDisconnect',
                                 ['Transport creation failed.']);
    return;
  }

  var onDisconnect = function(e) {
    console.log('wam.transport.ChromePort.connect: disconnect');
    port.onMessage.removeListener(onMessage);
    port.onDisconnect.removeListener(onDisconnect);
    this.readyBinding.closeError('wam.Error.TransportDisconnect',
                                 ['Transport disconnected before accept.']);
  }.bind(this);

  var onMessage = function(msg) {
    port.onMessage.removeListener(onMessage);
    port.onDisconnect.removeListener(onDisconnect);

    if (msg != 'accepted') {
      port.disconnect();
      this.readyBinding.closeError('wam.Error.TransportDisconnect',
                                   ['Bad transport handshake.']);
      return;
    }

    this.setPort_(port);
    this.readyBinding.ready();
  }.bind(this);

  port.onDisconnect.addListener(onDisconnect);
  port.onMessage.addListener(onMessage);
};

/**
 * The 'onConnect' function passed to listen.
 *
 * We invoke this whenever we hear a connection from port with the proper name.
 */
wam.transport.ChromePort.onConnectCallback_ = null;

wam.transport.ChromePort.prototype.onReadyBindingClose_ = function() {
  if (this.port_)
    this.port_.disconnect();
};

/**
 * Invoked when an foreign extension attempts to connect while we're listening.
 */
wam.transport.ChromePort.onConnectExternal_ = function(port) {
  var whitelist = wam.transport.ChromePort.connectWhitelist_
  if (whitelist && whitelist.indexOf(port.sender.id) == -1) {
    console.log('wam.transport.ChromePort: reject: ' +
                'Sender is not on the whitelist: ' + port.sender.id);
    port.disconnect();
    return;
  }

  if (port.name != 'x.wam.transport.ChromePort/1.0') {
    console.log('wam.transport.ChromePort: ' +
                'reject: Ignoring unknown connection: ' + port.name);
    port.disconnect();
    return;
  }

  var transport = new wam.transport.ChromePort();
  transport.accept(port);
  wam.transport.ChromePort.onListenCallback_(transport);
};

/**
 * Start listening for connections from foreign extensions.
 *
 * @param {Array<string>} whitelist A whitelist of extension ids that may
 *   connect.  Pass null to disable the whitelist and allow all connections.
 * @param {function(wam.transport.ChromePort)} onConnect A callback to invoke
 *   when a new connection is made.
 */
wam.transport.ChromePort.listen = function(whitelist, onConnect) {
  if (onConnect == null) {
    if (!wam.transport.ChromePort.onConnectCallback_)
      throw new Error('wam.transport.ChromePort is not listening.');

    console.log('wam.transport.ChromePort.connect: listen canceled');

    wam.transport.ChromePort.onListenCallback_ = null;
    wam.transport.ChromePort.connectWhitelist_ = null;
    chrome.runtime.onConnectExternal.removeListener(
        wam.transport.ChromePort.onConnectExternal_);

  } else {
    if (wam.transport.ChromePort.onConnectCallback_)
      throw new Error('wam.transport.ChromePort is already listening.');

    console.log('wam.transport.ChromePort.connect: listen');

    wam.transport.ChromePort.onListenCallback_ = onConnect;
    wam.transport.ChromePort.connectWhitelist_ = whitelist;
    chrome.runtime.onConnectExternal.addListener(
        wam.transport.ChromePort.onConnectExternal_);
  }
};
