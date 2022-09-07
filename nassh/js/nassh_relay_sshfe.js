// Copyright 2018 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Implementation for the ssh-fe@google.com proxy.
 */

import {getGnubbyExtension} from './nassh_google.js';
import {Relay} from './nassh_relay.js';
import {RelaySshfeWsStream} from './nassh_stream_relay_sshfe.js';

/**
 * SSH-FE relay implementation.
 */
export class Sshfe extends Relay {
  /** @inheritDoc */
  constructor(io, options, location, storage, localPrefs) {
    super(io, options, location, storage, localPrefs);
    this.sshAgent_ = options['--ssh-agent'] || getGnubbyExtension();
    this.relayServer = `wss://${this.proxyHost}:${this.proxyPort}`;
  }

  /** @inheritDoc */
  redirect() {
    // This shouldn't be called in the first place.
    throw new Error('ssh-fe does not redirect');
  }

  /** @inheritDoc */
  async init() {
    // Most init happens in the stream below.
    return true;
  }

  /** @inheritDoc */
  saveState() { return {}; }

  /** @inheritDoc */
  loadState(state) {}

  /** @inheritDoc */
  openSocket(fd, host, port, streams, onOpen) {
    const settings = {
      io: this.io_,
      relayHost: this.proxyHost,
      relayPort: this.proxyPort,
      relayUser: this.username,
      host: host,
      port: port,
      sshAgent: this.sshAgent_,
    };
    return streams.openStream(RelaySshfeWsStream, fd, settings, onOpen);
  }
}
