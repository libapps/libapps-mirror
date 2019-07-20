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
  this.resumeConnection = !!options['--resume-connection'];
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

  const uri = lib.f.replaceVars(
    this.cookieServerPattern(),
    { host: this.proxyHost,
      port: this.proxyPort,
      protocol: this.useSecure ? 'https' : 'http',
      // This returns us to nassh_google_relay.html so we can pick the relay
      // host out of the reply.  From there we continue on to the resumePath.
      return_to:  this.location.host
    });

  // Since the proxy settings are coming from the user, make sure we catch bad
  // values (hostnames/etc...) directly.
  try {
    this.location.href = uri;
  } catch(e) {
    this.io.println(e);
    return false;
  }

  return true;
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
  const options = {
    relay: this,
    host: host,
    port: port,
    resume: this.resumeConnection,
  };
  return streams.openStream(streamClass, fd, options, onOpen);
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
