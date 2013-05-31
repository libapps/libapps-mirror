// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.Event');

/**
 * This is the chrome message port based transport.
 */
lib.wa.ChromePortTransport = function(port) {
  // The underlying Chrome "platform app" port.
  this.port_ = port;

  this.verbose = false;

  this.isConnected = true;

  /**
   * Subscribe to this event to listen in on inbound messages.
   */
  this.onMessage = new lib.Event(function(msg) {
      if (this.verbose)
        console.log(msg);
    }.bind(this));

  /**
   * Subscribe to this event to listen for transport disconnect.
   */
  this.onDisconnect = new lib.Event(function(msg) {
      if (this.verbose)
        console.log('chrome port transport disconnect.');
    }.bind(this));

  this.port_.onMessage.addListener(function(msg) {
      // Chrome message ports eat exceptions, so we break them off into
      // a setTimeout :/

      setTimeout(this.onMessage.bind(this.onMessage, msg), 0);
    }.bind(this));
  this.port_.onDisconnect.addListener(this.onDisconnect);
};

lib.wa.ChromePortTransport.prototype.send = function(value) {
  this.port_.postMessage(value);
};

lib.wa.ChromePortTransport.prototype.disconnect = function() {
  this.port_.disconnect();
};

lib.wa.ChromePortTransport.connect = function(extensionId, onComplete) {
  var port = chrome.runtime.connect(
      extensionId, {name: 'lib.wa.ChromePortTransport/1.0'});

  window.p_ = port;

  if (!port) {
    setTimeout(onComplete.bind(null, null));
    return;
  }

  var onDisconnect = function(e) {
    console.log('lib.wa.ChromePortTransport.connect: disconnect');
    port.onMessage.removeListener(onMessage);
    port.onDisconnect.removeListener(onDisconnect);
    onComplete(null);
  };

  var onMessage = function(msg) {
    port.onMessage.removeListener(onMessage);
    port.onDisconnect.removeListener(onDisconnect);

    if (msg == 'accepted') {
      onComplete(new lib.wa.ChromePortTransport(port));
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
lib.wa.ChromePortTransport.onConnectCallback_ = null;

/**
 * Invoked when an foreign extension attempts to connect while we're listening.
 */
lib.wa.ChromePortTransport.onConnectExternal_ = function(port) {
  console.log('lib.wa.ChromePortTransport.onConnectExternal_: connect');

  var whitelist = lib.wa.ChromePortTransport.connectWhitelist_
  if (whitelist && whitelist.indexOf(port.sender.id) == -1) {
    console.log('Sender is not on the whitelist: ' + port.sender.id);
    port.disconnect();
    return;
  }

  if (port.name != 'lib.wa.ChromePortTransport/1.0') {
    console.log('Ignoring unknown connection: ' + port.name);
    port.disconnect();
    return;
  }

  var transport = new lib.wa.ChromePortTransport(port);
  lib.wa.ChromePortTransport.onListenCallback_(transport);

  transport.send('accepted');
};

/**
 * Start listening for connections from foreign extensions.
 *
 * @param {Array<string>} whitelist A whitelist of extension ids that may
 *   connect.  Pass null to disable the whitelist and allow all connections.
 * @param {function(lib.wa.ChromePortTransport)} onConnect A callback to invoke
 *   when a new connection is made.
 */
lib.wa.ChromePortTransport.listen = function(whitelist, onConnect) {
  if (onConnect == null) {
    if (!lib.wa.ChromePortTransport.onConnectCallback_)
      throw 'lib.wa.ChromePortTransport is not listening.';

    lib.wa.ChromePortTransport.onListenCallback_ = null;
    lib.wa.ChromePortTransport.connectWhitelist_ = null;
    chrome.runtime.onConnectExternal.removeListener(
        lib.wa.ChromePortTransport.onConnectExternal_);

  } else {
    if (lib.wa.ChromePortTransport.onConnectCallback_)
      throw 'lib.wa.ChromePortTransport is already listening.';

    lib.wa.ChromePortTransport.onListenCallback_ = onConnect;
    lib.wa.ChromePortTransport.connectWhitelist_ = whitelist;
    chrome.runtime.onConnectExternal.addListener(
        lib.wa.ChromePortTransport.onConnectExternal_);
  }
};
