// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Implementation for the corp-relay@google.com proxy.
 */

/**
 * Corp Relay implementation.
 */
nassh.relay.Corp = class extends nassh.Relay {
  /** @inheritDoc */
  constructor(io, options, location, storage) {
    super(io, options, location, storage);
    this.useSecure = options['--use-ssl'];
    this.useWebsocket = !options['--use-xhr'];
    this.reportAckLatency = options['--report-ack-latency'];
    this.reportConnectAttempts = options['--report-connect-attempts'];
    this.relayProtocol = options['--relay-protocol'];
    this.relayServer = null;
    this.relayServerSocket = null;
  }

  /**
   * Returns the pattern for the cookie server URL.
   *
   * @return {string} The fully URI pattern.
   */
  cookieServerPattern() {
    let template = '%(protocol)://%(host):%(port)/cookie' +
        '?ext=%encodeURIComponent(return_to)' +
        '&path=html/nassh_google_relay.html';
    if (this.relayProtocol === 'v2') {
      template += '&version=2&method=js-redirect';
    }
    return template;
  }

  /** @inheritDoc */
  redirect() {
    const resumePath = this.location.href.substr(this.location.origin.length);

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
      this.io_.println(e);
      this.io_.println(uri);
      return false;
    }

    this.location.href = uri;
    return true;
  }

  /** @inheritDoc */
  init() {
    const resumePath = this.location.href.substr(this.location.origin.length);

    // This session storage item is created by /html/nassh_google_relay.html
    // if we succeed at finding a relay host.
    const relayHost = this.storage.getItem('googleRelay.relayHost');
    const relayPort = this.storage.getItem('googleRelay.relayPort') ||
        this.proxyPort;

    if (relayHost) {
      const expectedResumePath = this.storage.getItem('googleRelay.resumePath');
      if (expectedResumePath === resumePath) {
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
        // to do the same init.  (The first time would have redirected.)  If
        // this init specifies a different resumePath, then something is
        // probably wrong.
        console.warn(`Destination mismatch: ${expectedResumePath} != ` +
                     `${resumePath}`);
        this.relayServer = null;
      }
    }

    this.storage.removeItem('googleRelay.relayHost');
    this.storage.removeItem('googleRelay.relayPort');
    this.storage.removeItem('googleRelay.resumePath');

    if (this.relayServer) {
      this.io_.println(nassh.msg('FOUND_RELAY', [this.relayServer]));
      return true;
    }

    return false;
  }

  /** @inheritDoc */
  saveState() {
    return {
      relayServer: this.relayServer,
      relayServerSocket: this.relayServerSocket,
    };
  }

  /** @inheritDoc */
  loadState(state) {
    this.relayServer = state.relayServer;
    this.relayServerSocket = state.relayServerSocket;
  }

  /** @inheritDoc */
  openSocket(fd, host, port, streams, onOpen) {
    const streamClass = this.useWebsocket ? nassh.Stream.RelayCorpWS :
                                            nassh.Stream.RelayCorpXHR;
    const options = {
      io: this.io_,
      relay: this,
      host: host,
      port: port,
      resume: this.resumeConnection,
    };
    return streams.openStream(streamClass, fd, options, onOpen);
  }
};

/**
 * @override
 * @type {number}
 */
nassh.relay.Corp.prototype.defaultProxyPort = 8022;

/**
 * The pattern for XHR relay server's url.
 *
 * We'll be appending 'proxy', 'read' and 'write' to this as necessary.
 *
 * @const {string}
 */
nassh.relay.Corp.prototype.relayServerPattern =
    '%(protocol)://%(host):%(port)/';
