// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Implementation for the corp-relay@google.com proxy.
 */

import {lib} from '../../libdot/index.js';

import {localize} from './nassh.js';
import {Relay} from './nassh_relay.js';
import {Stream} from './nassh_stream.js';
import {RelayCorpWsStream,
        RelayCorpXhrStream} from './nassh_stream_relay_corp.js';

/**
 * Corp Relay implementation.
 */
export class Corp extends Relay {
  /** @inheritDoc */
  constructor(io, options, location, storage, localPrefs) {
    super(io, options, location, storage, localPrefs);
    this.proxyHostFallback = options['--proxy-host-fallback'];
    this.useSecure = options['--use-ssl'];
    this.useWebsocket = !options['--use-xhr'];
    this.reportAckLatency = options['--report-ack-latency'];
    this.reportConnectAttempts = options['--report-connect-attempts'];
    this.relayProtocol = options['--relay-protocol'];
    this.relayMethod = options['--relay-method'];
    this.relayServer = null;
    this.relayServerSocket = null;
    this.egressDomain = options['--egress-domain'];
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
    if (this.remoteHost) {
      template += '&host=%(remote_host)';
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
        remote_host: this.remoteHost,
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

    this.location.replace(uri);
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
      this.io_.println(localize('FOUND_RELAY', [this.relayServer]));
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
   * Return Stream class to use.
   *
   * @return {function(new:Stream, number, ?)}
   */
  getStreamClass() {
    return this.useWebsocket ? RelayCorpWsStream : RelayCorpXhrStream;
  }

  /** @inheritDoc */
  openSocket(fd, host, port, streams, onOpen) {
    const options = {
      io: this.io_,
      relayServer: this.relayServer,
      relayServerSocket: this.relayServerSocket,
      relayUser: this.username,
      reportConnectAttempts: this.reportConnectAttempts,
      reportAckLatency: this.reportAckLatency,
      host: host,
      port: port,
      resume: this.resumeConnection,
      localPrefs: this.localPrefs,
      egressDomain: this.egressDomain,
    };
    return streams.openStream(this.getStreamClass(), fd, options, onOpen);
  }

  /**
   * Authenticates to proxy using fetch with method=direct. Refreshes ticket
   * from full cookie if possible, else opens a login popup if required.
   *
   * @return {!Promise<boolean>} true if authentication succeeded, else false on
   *     error.
   */
  async authenticateDirect() {
    const protocol = this.useSecure ? 'https' : 'http';
    let endpoint = `${this.proxyHost}:${this.proxyPort}`;
    const params = this.remoteHost ? `?host=${this.remoteHost}` : '';
    let proxyUrl = `${protocol}://${endpoint}/endpoint${params}`;

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

    // Query for endpoint. On failure we might as well continue and attempt
    // to connect to /cookie using one of the proxy hosts from the config
    // instead of from the /endpoint response.
    try {
      endpoint = await this.fetchEndpoint(proxyUrl);
    } catch (e) {
      console.warn('Query endpoint failed', e);
      if (this.proxyHostFallback) {
        try {
          endpoint = `${this.proxyHostFallback}:${this.proxyPort}`;
          proxyUrl = `${protocol}://${endpoint}/endpoint${params}`;
          endpoint = await this.fetchEndpoint(proxyUrl);
        } catch (e) {
          console.warn('Fallback query endpoint failed', e);
        }
      }
    }

    // Validate cookie. This will fail if ticket or full cookie not set.
    proxyUrl = `${protocol}://${endpoint}/cookie?version=2`;
    try {
      await this.validateCookie(proxyUrl);
      return true;
    } catch (e) {
      console.info(`Refresh ticket and query endpoint again: ${e.message}`);
    }

    // Refresh ticket and validate ticket again. This will fail if full cookie
    // not set.
    try {
      await this.refreshTicket(proxyUrl);
      await this.validateCookie(proxyUrl);
      return true;
    } catch (e) {
      console.info(`Login and query endpoint again: ${e.message}`);
    }

    // Show a login popup, then validate ticket again.
    try {
      await this.showLoginPopup(proxyUrl);
      await this.validateCookie(proxyUrl);
      return true;
    } catch (e) {
      console.warn('Error in login and query endpoint', e);
      return false;
    }
  }

  /**
   * Query proxy /endpoint to get relay /cookie host.
   *
   * @param {string} proxy Proxy url to connect to.
   * @return {!Promise<string>}
   */
  async fetchEndpoint(proxy) {
    const res = await fetch(proxy);
    const text = await res.text();
    // Skip the XSSI countermeasure.
    if (!text.startsWith(")]}'\n")) {
      throw Error(`Unknown response: ${text}`);
    }
    const params = JSON.parse(text.slice(5));
    // Expecting format: {endpoint: <host[:port]>}.  Port is optional.
    // E.g. {"endpoint": "sup-ssh-relay.corp.google.com:8046"}.
    const endpoint = params['endpoint'];
    if (!endpoint) {
      throw new Error(params['error'] || `No endpoint from ${proxy}`);
    }
    return endpoint;
  }

  /**
   * Query proxy /cookie using 'method=direct'. We must include
   * credentials (cookies) and cors in order to read the json response.
   * This fetch request will succeed if we already have a valid ticket.
   * Otherwise, the proxy server will redirect us to the login server which will
   * fail with cors issues. In such a case, we will first attempt
   * refreshTicket(), or finally showLoginPopup() and reattempt this function.
   *
   * @param {string} proxy Proxy url to connect to.
   */
  async validateCookie(proxy) {
    const url = `${proxy}&method=direct`;
    const res = await fetch(url, {credentials: 'include'});
    const text = await res.text();
    // Skip the XSSI countermeasure.
    if (!text.startsWith(")]}'\n")) {
      throw Error(`Unknown response: ${text}`);
    }
    const params = JSON.parse(text.slice(5));
    // Expecting format: {endpoint: <host[:port]>}.  Port is optional.
    // E.g. {"endpoint": "sup-ssh-relay.corp.google.com:8046"}.
    const endpoint = params['endpoint'];
    if (endpoint) {
      this.io_.println(localize('FOUND_RELAY', [endpoint]));
      const serverProtocol = this.useSecure ? 'https' : 'http';
      const socketProtocol = this.useSecure ? 'wss' : 'ws';
      this.relayServer = `${serverProtocol}://${endpoint}/`;
      this.relayServerSocket = `${socketProtocol}://${endpoint}/`;
      return;
    }
    throw new Error(params['error'] || `No endpoint from ${proxy}`);
  }

  /**
   * Fetch from proxy in no-cors in order to allow redirects to
   * login.corp.google.com where a valid full cookie will be used to issue
   * a ticket.
   *
   * @param {string} proxy Proxy url to connect to.
   */
  async refreshTicket(proxy) {
    const url = `${proxy}&method=direct`;
    await fetch(url, {credentials: 'include', mode: 'no-cors'});
  }

  /**
   * Open a popup window for the proxy with 'method=close'.  This will redirect
   * to login.corp.google.com where users can reauthenticate (password,gnubby),
   * and return back to the proxy with a valid ticket. By using `method=close',
   * the proxy will close the popup, and a subsequent call to
   * validateCookie() should succeed.
   *
   * @param {string} proxy Proxy url to connect to.
   */
  async showLoginPopup(proxy) {
    const url = `${proxy}&method=close&origin=${
        encodeURIComponent(globalThis.location.origin)}`;
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
    await new Promise((resolve) => {
      const listener = () => {
        if (popup.closed) {
          chrome.windows.onRemoved.removeListener(listener);
          resolve();
        }
      };
      chrome.windows.onRemoved.addListener(listener);
    });
  }
}

/**
 * @override
 * @type {number}
 */
Corp.prototype.defaultProxyPort = 8022;

/**
 * The pattern for XHR relay server's url.
 *
 * We'll be appending 'proxy', 'read' and 'write' to this as necessary.
 *
 * @const {string}
 */
Corp.prototype.relayServerPattern = '%(protocol)://%(host):%(port)/';
