// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.f');

/**
 * This file contains the support required to make connections to Google's
 * HTTP-to-SSH relay.
 *
 * See Also: nassh_stream_google_relay.js, which defines the hterm stream class
 * for this relay mechanism.
 *
 * The relay is only available within Google at the moment.  If you'd like
 * to create one of your own though, you could follow the same conventions
 * and have a client ready to go.
 *
 * The connection looks like this...
 *
 *  +------+   +-------+   +---------------+
 *  | USER |   | PROXY |   | COOKIE_SERVER |
 *  +------+   +-------+   +---------------+
 *
 *                         +-----------+
 *                         | SSH_RELAY |
 *                         +-----------+
 *
 * 1. User specifies that they'd like to make their ssh connection through a
 *    web server.  In this code, that web server is called the 'proxy', since
 *    it happens to be an HTTP proxy.
 *
 * 2. We redirect to the 'http://HOST:8022/cookie?ext=RETURN_TO'.
 *
 *      HOST is the user-specified hostname for the proxy.  Port 8022 on the
 *      proxy is assumed to be the cookie server.
 *
 *      RETURN_TO is the location that the cookie server should redirect to
 *      when the cookie server is satisfied.
 *
 *    This connects us to the 'cookie server', which can initiate a
 *    single-sign-on flow if necessary.  It's also responsible for telling us
 *    which SSH_RELAY server we should talk to for the actual ssh read/write
 *    operations.
 *
 * 3. When the cookie server is done with its business it redirects to
 *    /html/google_relay.html#USER@RELAY_HOST.
 *
 *    The RELAY_HOST is the host that we should use as the socket relay.
 *    This allows the cookie server to choose a relay server from a
 *    pool of hosts.  This is *just* the host name, it's up to clients to
 *    know the uri scheme and port number.
 *
 *    The RELAY_HOST is expected to respond to requests for /proxy, /write,
 *    and /read.
 *
 * 4. We send a request to /proxy, which establishes the ssh session with
 *    a remote host.
 *
 * 5. We establish a hanging GET on /read.  If the read completes with a
 *    HTTP 200 OK then we consider the response entity as web-safe base 64
 *    encoded data.  If the read completes with an HTTP 401 GONE, we assume
 *    the relay has discarded the ssh session.  Any other responses are
 *    ignored.  The /read request is reestablished for anything other than
 *    401.
 *
 * 6. Writes are queued up and sent to /write.
 */

nassh.GoogleRelay = function(io, options, relayLocation, relayStorage) {
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
  this.location = relayLocation;
  this.storage = relayStorage;
};

/**
 * Returns the pattern for the cookie server URL.
 */
nassh.GoogleRelay.prototype.cookieServerPattern = function() {
  var template = '%(protocol)://%(host):%(port)/cookie' +
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
nassh.GoogleRelay.prototype.relayServerPattern =
    '%(protocol)://%(host):%(port)/';

nassh.GoogleRelay.prototype.redirect = function(opt_resumePath) {
  var resumePath = opt_resumePath ||
    this.location.href.substr(this.location.origin.length);

  // Save off our destination in session storage before we leave for the
  // proxy page.
  this.storage.setItem('googleRelay.resumePath', resumePath);

  this.location.href = lib.f.replaceVars(
    this.cookieServerPattern(),
    { host: this.proxyHost,
      port: this.proxyPort,
      protocol: this.useSecure ? 'https' : 'http',
      // This returns us to nassh_google_relay.html so we can pick the relay
      // host out of the reply.  From there we continue on to the resumePath.
      return_to:  this.location.host
    });
};

/**
 * Initialize this relay object.
 *
 * If we haven't just come back from the cookie server, then this function
 * will redirect to the cookie server and return false.
 *
 * If we have just come back from the cookie server, then we'll return true.
 */
nassh.GoogleRelay.prototype.init = function(opt_resumePath) {
  var resumePath = opt_resumePath ||
      this.location.href.substr(this.location.origin.length);

  // This session storage item is created by /html/nassh_google_relay.html
  // if we succeed at finding a relay host.
  var relayHost = this.storage.getItem('googleRelay.relayHost');
  var relayPort = this.storage.getItem('googleRelay.relayPort') ||
      this.proxyPort;

  if (relayHost) {
    var expectedResumePath =
        this.storage.getItem('googleRelay.resumePath');
    if (expectedResumePath == resumePath) {
      var protocol = this.useSecure ? 'https' : 'http';
      var pattern = this.relayServerPattern;
      this.relayServer = lib.f.replaceVars(pattern,
          {host: relayHost, port: relayPort, protocol: protocol});
      if (!this.useXHR) {
        protocol = this.useSecure ? 'wss' : 'ws';
        this.relayServerSocket = lib.f.replaceVars(pattern,
            {host: relayHost, port: relayPort, protocol: protocol});
      }

      // If we made it this far, we're probably not stuck in a redirect loop.
      sessionStorage.removeItem('googleRelay.redirectCount');
    } else {
      // If everything is ok, this should be the second time we've been asked
      // to do the same init.  (The first time would have redirected.)  If this
      // init specifies a different resumePath, then something is probably
      // wrong.
      console.warn('Destination mismatch: ' + expectedResumePath + ' != ' +
                   resumePath);
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
 */
nassh.GoogleRelay.prototype.openSocket = function(fd, host, port, streams,
                                                  onOpen) {
  var streamClass = this.useWebsocket ? nassh.Stream.GoogleRelayWS :
                                        nassh.Stream.GoogleRelayXHR;
  return streams.openStream(streamClass,
      fd, {relay: this, host: host, port: port}, onOpen);
};

/**
 * Find a usable gnubby extension.
 */
nassh.GoogleRelay.findGnubbyExtension = function() {
  // If we're not in an extension context, nothing to do.
  if (!window.chrome || !chrome.runtime) {
    return;
  }

  // The possible gnubby extensions.
  const stableAppId = 'beknehfpfkghjoafdifaflglpjkojoco';
  const stableExtId = 'lkjlajklkdhaneeelolkfgbpikkgnkpk';
  // The order matches the gnubby team preferences: https://crbug.com/902588
  // Prefer the extension over the app, and dev over stable.
  const extensions = [
    'klnjmillfildbbimkincljmfoepfhjjj',  // extension (dev)
    stableExtId,                         // extension (stable)
    'dlfcjilkjfhdnfiecknlnddkmmiofjbg',  // app (dev)
    stableAppId,                         // app (stable)
    'kmendfapggjehodndflmmgagdbamhnfd',  // component
  ];

  // Ping the extension to see if it's installed/enabled/alive.
  const check = (id) => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(id, {'type': 'HELLO'}, (result) => {
      // If the remote side doesn't exist (which is normal), Chrome complains
      // if we don't read the lastError.  Clear that here.
      lib.f.lastError();

      // If the probe worked, return the id, else return nothing so we can
      // clear out all the pending promises.
      if (result !== undefined && result['rc'] == 0)
        resolve(id);
      else
        resolve();
    });
  });

  // Guess a reasonable default based on the OS.
  nassh.GoogleRelay.defaultGnubbyExtension =
      (hterm.os == 'cros' ? stableAppId : stableExtId);

  // We don't set a timeout here as it doesn't block overall execution.
  Promise.all(extensions.map((id) => check(id))).then((results) => {
    console.log(`gnubby probe results: ${results}`);
    for (let i = 0; i < extensions.length; ++i) {
      const extId = extensions[i];
      if (results.includes(extId)) {
        nassh.GoogleRelay.defaultGnubbyExtension = extId;
        break;
      }
    }
  });
};

/**
 * Register gnubby extension probing.
 *
 * This could take time to resolve, so do it as part of start up.
 * It resolves using promises in the background, so this is OK.
 */
lib.registerInit('gnubby probe', function(onInit) {
  nassh.GoogleRelay.findGnubbyExtension();

  onInit();
});
