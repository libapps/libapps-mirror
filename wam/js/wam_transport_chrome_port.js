// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * This is the chrome message port based transport.
 */
wam.transport.ChromePort = function(port) {
  // The underlying Chrome "platform app" port.
  this.port_ = port;

  this.readyBinding = new wam.binding.Ready();
  this.readyBinding.onClose.addListener(this.onReadyBindingClose_.bind(this));
  this.readyBinding.ready();

  this.verbose = false;

  this.isConnected = true;

  port.onDisconnect.addListener(this.onPortDisconnect_.bind(this));

  /**
   * Subscribe to this event to listen in on inbound messages.
   */
  this.onMessage = new wam.Event(function(msg) {
      if (this.verbose)
        console.log(msg);
    }.bind(this));

  this.port_.onMessage.addListener(function(msg) {
      // Chrome message ports eat exceptions, so we break them off into
      // a setTimeout :/

      setTimeout(this.onMessage.bind(this.onMessage, msg), 0);
    }.bind(this));
  this.port_.onDisconnect.addListener(this.onDisconnect);
};

wam.transport.ChromePort.prototype.send = function(value, opt_onSend) {
  this.port_.postMessage(value);
  if (opt_onSend)
    wam.async(opt_onSend);
};

wam.transport.ChromePort.connect = function(extensionId, onComplete) {
  var port = chrome.runtime.connect(
      extensionId, {name: 'x.wam.transport.ChromePort/1.0'});

  window.p_ = port;

  if (!port) {
    setTimeout(onComplete.bind(null, null));
    return;
  }

  var onDisconnect = function(e) {
    console.log('transport.ChromePort.connect: disconnect');
    port.onMessage.removeListener(onMessage);
    port.onDisconnect.removeListener(onDisconnect);
    onComplete(null);
  };

  var onMessage = function(msg) {
    port.onMessage.removeListener(onMessage);
    port.onDisconnect.removeListener(onDisconnect);

    if (msg == 'accepted') {
      onComplete(new wam.transport.ChromePort(port));
    } else {
      port.disconnect();
      onComplete(null);
    }
  };

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
  this.port_.disconnect();
};

wam.transport.ChromePort.prototype.onPortDisconnect_ = function() {
  if (!this.readyBinding.isOpen)
    this.readyBinding.closeOk(null);
};

/**
 * Invoked when an foreign extension attempts to connect while we're listening.
 */
wam.transport.ChromePort.onConnectExternal_ = function(port) {
  console.log('transport.ChromePort.onConnectExternal_: connect');

  var whitelist = wam.transport.ChromePort.connectWhitelist_
  if (whitelist && whitelist.indexOf(port.sender.id) == -1) {
    console.log('Sender is not on the whitelist: ' + port.sender.id);
    port.disconnect();
    return;
  }

  if (port.name != 'x.wam.transport.ChromePort/1.0') {
    console.log('Ignoring unknown connection: ' + port.name);
    port.disconnect();
    return;
  }

  var transport = new wam.transport.ChromePort(port);
  wam.transport.ChromePort.onListenCallback_(transport);

  transport.send('accepted');
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
      throw 'transport.ChromePort is not listening.';

    wam.transport.ChromePort.onListenCallback_ = null;
    wam.transport.ChromePort.connectWhitelist_ = null;
    chrome.runtime.onConnectExternal.removeListener(
        wam.transport.ChromePort.onConnectExternal_);

  } else {
    if (wam.transport.ChromePort.onConnectCallback_)
      throw 'transport.ChromePort is already listening.';

    wam.transport.ChromePort.onListenCallback_ = onConnect;
    wam.transport.ChromePort.connectWhitelist_ = whitelist;
    chrome.runtime.onConnectExternal.addListener(
        wam.transport.ChromePort.onConnectExternal_);
  }
};
