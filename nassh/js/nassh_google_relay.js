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

nassh.GoogleRelay = function(io, optionString, relayLocation, relayStorage) {
  this.io = io;
  this.options = nassh.GoogleRelay.parseOptionString(optionString);
  this.proxyHost = this.options['--proxy-host'];
  this.proxyPort = this.options['--proxy-port'] || 8022;
  this.useSecure = this.options['--use-ssl'];
  this.useWebsocket = !this.options['--use-xhr'];
  this.reportAckLatency = this.options['--report-ack-latency'];
  this.reportConnectAttempts = this.options['--report-connect-attempts'];
  this.relayProtocol = this.options['--relay-protocol'];
  this.relayServer = null;
  this.relayServerSocket = null;
  this.location = relayLocation;
  this.storage = relayStorage;
};

nassh.GoogleRelay.parseOptionString = function(optionString) {
  var rv = {};

  var optionList = optionString.trim().split(/\s+/g);
  for (var i = 0; i < optionList.length; i++) {
    // Make sure it's a long option first.
    const option = optionList[i];
    if (!option.startsWith('--'))
      throw Error(option);

    // Split apart the option if there is an = in it.
    let flag, value;
    const pos = option.indexOf('=');
    if (pos == -1) {
      // If there is no = then it's a boolean flag (which --no- disables).
      value = !option.startsWith('--no-');
      flag = option.slice(value ? 2 : 5);
    } else {
      flag = option.slice(2, pos);
      value = option.slice(pos + 1);
    }

    // Verify it's an option we support.
    if (!nassh.GoogleRelay.parseOptionString.validOptions_.includes(flag))
      throw Error(option);

    rv[`--${flag}`] = value;
  }

  if (rv['--config'] == 'google') {
    rv['auth-agent-forward'] = true;
    if (!('--proxy-host' in rv))
      rv['--proxy-host'] = 'ssh-relay.corp.google.com';
    if (!('--proxy-port' in rv))
      rv['--proxy-port'] = '443';
    if (!('--use-ssl' in rv))
      rv['--use-ssl'] = true;
    if (!('--report-ack-latency' in rv))
      rv['--report-ack-latency'] = true;
    if (!('--report-connect-attempts' in rv))
      rv['--report-connect-attempts'] = true;
    if (!('--relay-protocol' in rv))
      rv['--relay-protocol'] = 'v2';
    if (!('--ssh-agent' in rv))
      rv['--ssh-agent'] = nassh.GoogleRelay.defaultGnubbyExtension;
  }

  return rv;
};

/**
 * All possible flags that may show up in the relay options.
 * Currently this covers all options even non-Google relay ones.
 *
 * Note: Keep this in sync with nassh_connect_dialog.html.
 */
nassh.GoogleRelay.parseOptionString.validOptions_ = [
  'config',
  'proxy-host',
  'proxy-port',
  'relay-prefix-field',
  'relay-protocol',
  'report-ack-latency',
  'report-connect-attempts',
  'ssh-agent',
  'ssh-client-version',
  'use-ssl',
  'use-xhr',
];

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
    var relayPrefixField = parseInt(this.options['--relay-prefix-field']);
    if (relayPrefixField) {
      // If this option is set, we're supposed to assume the relayHost is a
      // '.' delimited list of fields (like a hostname), isolate the field
      // at the 1-based relayPrefixField position, and create the actual
      // relayHost by prepending this field to the original proxyHost.
      //
      // TODO(rginda): Yes, this is a kludge.  Returning the correct hostname
      // from the proxy is sometimes difficult, for a reason unknown to me.
      var relayPrefix = relayHost.split(/\./g)[relayPrefixField - 1];
      if (relayPrefix) {
        if (this.proxyHost.substr(0, relayPrefix.length + 1) !=
            relayPrefix + '.') {
          // Only add the prefix if the proxyHost doesn't already include it.
          relayHost = relayPrefix + '.' + this.proxyHost;
        } else {
          relayHost = this.proxyHost;
        }
      } else {
        console.warn('Error getting relay prefix field: ' + relayPrefixField +
                     ' from: ' + relayHost);
        this.relayHost = null;
      }
    }

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
  const appId = 'beknehfpfkghjoafdifaflglpjkojoco';
  const extId = 'lkjlajklkdhaneeelolkfgbpikkgnkpk';

  // Ping the extension to see if it's alive.
  const check = (id) => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(id, {'type': 'HELLO'}, (result) => {
      if (result !== undefined && result['rc'] == 0)
        resolve(id);
    });
  });

  // Pick a default in case neither is installed.
  nassh.GoogleRelay.defaultGnubbyExtension = extId;

  // We don't care which one is available, so go with the first response.
  Promise.race([
    check(appId),
    check(extId),
    new Promise((resolve, reject) => setTimeout(resolve, 1000)),
  ]).then((foundId) => {
    if (foundId)
      nassh.GoogleRelay.defaultGnubbyExtension = foundId;
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
