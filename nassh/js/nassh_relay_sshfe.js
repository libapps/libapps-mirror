// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Implementation for the ssh-fe@google.com proxy.
 */

/**
 * SSH-FE relay implementation.
 */
nassh.relay.Sshfe = class extends nassh.Relay {
  /** @inheritDoc */
  constructor(io, options, location, storage) {
    super(io, options, location, storage);
    this.sshAgent_ = options['--ssh-agent'] ||
        nassh.goog.gnubby.defaultExtension;
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
    return streams.openStream(nassh.Stream.RelaySshfeWS, fd, settings, onOpen);
  }
};
