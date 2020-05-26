// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Implementation for the corp-relay@google.com proxy.
 */

/**
 * Corp Relay implementation.
 *
 * @param {!hterm.Terminal.IO} io
 * @param {!Object} options
 * @param {!Location} relayLocation
 * @param {!Storage} relayStorage
 * @constructor
 */
nassh.relay.Corp = function(io, options, relayLocation, relayStorage) {
  this.io = io;
  this.proxyHost = options['--proxy-host'];
  this.proxyPort = options['--proxy-port'] || 8022;
  this.useSecure = options['--use-ssl'];
  this.useWebsocket = !options['--use-xhr'];
  this.reportAckLatency = options['--report-ack-latency'];
  this.reportConnectAttempts = options['--report-connect-attempts'];
  this.relayProtocol = options['--relay-protocol'];
  this.relayServer = null;
  this.relayServerSocket = null;
  this.resumeConnection = !!options['--resume-connection'];
  this.location = relayLocation;
  this.storage = relayStorage;
};

/**
 * Returns the pattern for the cookie server URL.
 *
 * @return {string}
 */
nassh.relay.Corp.prototype.cookieServerPattern = function() {
  let template = '%(protocol)://%(host):%(port)/cookie' +
      '?ext=%encodeURIComponent(return_to)' +
      '&path=html/nassh_google_relay.html';
  if (this.relayProtocol == 'v2') {
    template += '&version=2&method=js-redirect';
  }
  return template;
};

/**
 * The pattern for XHR relay server's url.
 *
 * We'll be appending 'proxy', 'read' and 'write' to this as necessary.
 */
nassh.relay.Corp.prototype.relayServerPattern =
    '%(protocol)://%(host):%(port)/';

/**
 * Redirect to the relay lookup server to initialize the connection.
 *
 * @param {string=} resumePath
 * @return {boolean} Whether redirection was successful.
 */
nassh.relay.Corp.prototype.redirect = function(resumePath) {
  if (!resumePath) {
    resumePath = this.location.href.substr(this.location.origin.length);
  }

  // Save off our destination in session storage before we leave for the
  // proxy page.
  this.storage.setItem('googleRelay.resumePath', resumePath);

  const uri = lib.f.replaceVars(
    this.cookieServerPattern(), {
      host: this.proxyHost,
      port: this.proxyPort,
      protocol: this.useSecure ? 'https' : 'http',
      // This returns us to nassh_google_relay.html so we can pick the relay
      // host out of the reply.  From there we continue on to the resumePath.
      return_to: this.location.host,
    });

  // Since the proxy settings are coming from the user, make sure we catch bad
  // values (hostnames/etc...) directly.
  try {
    // eslint-disable-next-line no-new
    new URL(uri);
  } catch (e) {
    this.io.println(e);
    this.io.println(uri);
    return false;
  }

  this.location.href = uri;
  return true;
};

/**
 * Initialize this relay object.
 *
 * If we haven't just come back from the cookie server, then this function
 * will redirect to the cookie server and return false.
 *
 * If we have just come back from the cookie server, then we'll return true.
 *
 * @param {string=} resumePath
 * @return {boolean}
 */
nassh.relay.Corp.prototype.init = function(resumePath) {
  if (!resumePath) {
    resumePath = this.location.href.substr(this.location.origin.length);
  }

  // This session storage item is created by /html/nassh_google_relay.html
  // if we succeed at finding a relay host.
  const relayHost = this.storage.getItem('googleRelay.relayHost');
  const relayPort = this.storage.getItem('googleRelay.relayPort') ||
      this.proxyPort;

  if (relayHost) {
    const expectedResumePath = this.storage.getItem('googleRelay.resumePath');
    if (expectedResumePath == resumePath) {
      const pattern = this.relayServerPattern;
      this.relayServer = lib.f.replaceVars(pattern, {
        host: relayHost,
        port: relayPort,
        protocol: this.useSecure ? 'https' : 'http',
      });
      this.relayServerSocket = lib.f.replaceVars(pattern, {
        host: relayHost,
        port: relayPort,
        protocol: this.useSecure ? 'wss' : 'ws',
      });

      // If we made it this far, we're probably not stuck in a redirect loop.
      // Clear the counter used by the relay redirect page.
      this.storage.removeItem('googleRelay.redirectCount');
    } else {
      // If everything is ok, this should be the second time we've been asked
      // to do the same init.  (The first time would have redirected.)  If this
      // init specifies a different resumePath, then something is probably
      // wrong.
      console.warn(`Destination mismatch: ${expectedResumePath} != ` +
                   `${resumePath}`);
      this.relayServer = null;
    }
  }

  this.storage.removeItem('googleRelay.relayHost');
  this.storage.removeItem('googleRelay.relayPort');
  this.storage.removeItem('googleRelay.resumePath');

  if (this.relayServer) {
    this.io.println(nassh.msg('FOUND_RELAY', [this.relayServer]));
    return true;
  }

  return false;
};

/**
 * Return an nassh.Stream object that will handle the socket stream
 * for this relay.
 *
 * @param {number} fd
 * @param {string} host
 * @param {number} port
 * @param {!nassh.StreamSet} streams
 * @param {function(boolean, ?string=)} onOpen
 * @return {!nassh.Stream}
 */
nassh.relay.Corp.prototype.openSocket = function(fd, host, port, streams,
                                                  onOpen) {
  const streamClass = this.useWebsocket ? nassh.Stream.RelayCorpWS :
                                          nassh.Stream.RelayCorpXHR;
  const options = {
    relay: this,
    host: host,
    port: port,
    resume: this.resumeConnection,
  };
  return streams.openStream(streamClass, fd, options, onOpen);
};
