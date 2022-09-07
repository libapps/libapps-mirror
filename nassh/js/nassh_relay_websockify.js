// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Implementation for websockify proxies.
 */

import {Relay} from './nassh_relay.js';
import {RelayWebsockifyStream} from './nassh_stream_relay_websockify.js';

/**
 * Websockify relay implementation.
 *
 * NB: This defaults to using "insecure" WebSockets because most people won't
 * have properly signed certificates, and because we don't actually need the
 * SSH traffic to be encrypted -- SSH itself already does that.
 *
 * @see https://github.com/novnc/websockify
 */
export class Websockify extends Relay {
  /** @inheritDoc */
  constructor(io, options, location, storage, localPrefs) {
    super(io, options, location, storage, localPrefs);
    this.useSecure = options['--use-ssl'];
  }

  /** @inheritDoc */
  redirect() {
    // This shouldn't be called in the first place.
    throw new Error('websockify does not redirect');
  }

  /** @inheritDoc */
  async init() {
    // No init required.
    return true;
  }

  /** @inheritDoc */
  saveState() { return {}; }

  /** @inheritDoc */
  loadState(state) {}

  /** @inheritDoc */
  openSocket(fd, host, port, streams, onOpen) {
    const settings = {
      relayHost: this.proxyHost,
      relayPort: this.proxyPort,
      host: host,
      port: port,
      protocol: this.useSecure ? 'wss' : 'ws',
    };
    return streams.openStream(RelayWebsockifyStream, fd, settings, onOpen);
  }
}

/**
 * The default proxy server port.
 *
 * Default to the server port instead of requiring a separate proxy port.
 *
 * TODO(vapier): Move to class fields once JS+closure-compiler support it.
 *
 * @type {number}
 * @override
 */
Websockify.prototype.defaultProxyPort = 0;
