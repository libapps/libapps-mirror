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
    this.relayMethod = options['--relay-method'];
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
  async init() {
    if (this.relayMethod === 'direct') {
      return this.authenticateDirect();
    }

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

  /**
   * Return nassh.Stream class to use.
   *
   * @return {function(new:nassh.Stream, number, ?)}
   */
  getStreamClass() {
    return this.useWebsocket ? nassh.Stream.RelayCorpWS :
                               nassh.Stream.RelayCorpXHR;
  }

  /** @inheritDoc */
  openSocket(fd, host, port, streams, onOpen) {
    const options = {
      io: this.io_,
      relayServer: this.relayServer,
      relayServerSocket: this.relayServerSocket,
      reportConnectAttempts: this.reportConnectAttempts,
      reportAckLatency: this.reportAckLatency,
      host: host,
      port: port,
      resume: this.resumeConnection,
    };
    return streams.openStream(this.getStreamClass(), fd, options, onOpen);
  }

  /**
   * Authenticates to proxy using fetch with method=direct. Refreshes ticket
   * from master cookie if possible, else opens a login popup if required.
   *
   * @return {!Promise<boolean>} true if authentication succeeded, else false on
   *     error.
   */
  async authenticateDirect() {
    const protocol = this.useSecure ? 'https' : 'http';
    const proxyUrl =
        `${protocol}://${this.proxyHost}:${this.proxyPort}/cookie?version=2`;

    // Since the proxy settings are coming from the user, make sure we catch bad
    // values (hostnames/etc...) directly.
    try {
      // eslint-disable-next-line no-new
      new URL(proxyUrl);
    } catch (e) {
      this.io_.println(e);
      this.io_.println(proxyUrl);
      return false;
    }

    // Query for endpoint. This will fail if ticket or master cookie not set.
    try {
      await this.fetchEndpointDirect(proxyUrl);
      return true;
    } catch (e) {
      console.warn('Refresh ticket and query endpoint again', e.message);
    }

    // Refresh ticket and query for endpoint again.
    try {
      await this.refreshTicket(proxyUrl);
      await this.fetchEndpointDirect(proxyUrl);
      return true;
    } catch (e) {
      console.warn('Login and query endpoint again', e.message);
    }

    // Show a login popup, then query for endpoint again.
    try {
      await this.showLoginPopup(proxyUrl);
      await this.fetchEndpointDirect(proxyUrl);
      return true;
    } catch (e) {
      console.warn('Error in login and query endpoint', e);
      return false;
    }
  }

  /**
   * Query proxy using 'method=direct' for endpoint. We must include
   * credentials (cookies) and cors in order to read the json response.
   * This fetch request will succeed if we already have a valid ticket.
   * Otherwise, the proxy server will redirect us to the login server which will
   * fail with cors issues. In such a case, we will first attempt
   * refreshTicket(), or finally showLoginPopup() and reattempt this function.
   *
   * @param {string} proxy Proxy url to connect to.
   */
  async fetchEndpointDirect(proxy) {
    const url = `${proxy}&method=direct`;
    const res = await fetch(url, {credentials: 'include'});
    const text = await res.text();
    // Skip the XSSI countermeasure.
    if (!text.startsWith(")]}'\n")) {
      throw Error(`Unknown response: ${text}`);
    }
    const params = JSON.parse(text.slice(5));
    // Expecting format: {"endpoint": "sup-ssh-relay.corp.google.com:8046"}.
    const endpoint = params['endpoint'];
    if (endpoint) {
      const [host, port] = endpoint.split(':');
      this.io_.println(nassh.msg('FOUND_RELAY', [endpoint]));
      const serverProtocol = this.useSecure ? 'https' : 'http';
      const socketProtocol = this.useSecure ? 'wss' : 'ws';
      this.relayServer = `${serverProtocol}://${endpoint}/`;
      this.relayServerSocket = `${socketProtocol}://${endpoint}/`;
      return;
    }
    throw new Error(params['error'] || 'No endpoint from ' + proxy);
  }

  /**
   * Fetch from proxy in no-cors in order to allow redirects to
   * login.corp.google.com where a valid master cookie will be used to issue
   * a ticket.
   *
   * @param {string} proxy Proxy url to connect to.
   */
  async refreshTicket(proxy) {
    const url = `${proxy}&method=direct`;
    await fetch(url, {credentials: 'include', mode: 'no-cors'});
  }

  /**
   * Open a popup window for the proxy with 'method=sendmessage'.  This will
   * redirect to login.corp.google.com where users can reauthenticate (password,
   * gnubby), and return back to the proxy with a valid ticket. By using
   * 'method=sendmessage', the proxy will close the popup, and a subsequent
   * call to fetchEndpointDirect() should succeed.
   *
   * @param {string} proxy Proxy url to connect to.
   */
  async showLoginPopup(proxy) {
    const url = `${proxy}&method=close&origin=${
        encodeURIComponent(window.location.origin)}`;
    const width = 1000;
    const height = 550;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    const features =
        `titlebar=no,width=${width},height=${height},top=${top},left=${left}`;
    const popup = lib.f.openWindow(url, '_blank', features);
    if (!popup) {
      throw new Error('Could not create login popup');
    }
    // TODO(crbug.com/1253752): Update chrome.windows.onRemoved to work for
    // non-extensions.
    await new Promise((resolve) => {
      const poll = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(poll);
          resolve();
        }
      }, 500);
    });
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
