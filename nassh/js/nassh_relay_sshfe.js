// Copyright 2018 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Implementation for the ssh-fe@google.com proxy.
 */

import {lib} from '../../libdot/index.js';

import {hterm} from '../../hterm/index.js';

import {getGoogleSshAgentExtension} from './nassh_google.js';
import {LocalPreferenceManager} from './nassh_preference_manager.js';
import {Relay} from './nassh_relay.js';
import {Stream} from './nassh_stream.js';
import {RelaySshfeWsStream} from './nassh_stream_relay_sshfe.js';

/**
 * SSH-FE relay implementation.
 */
export class Sshfe extends Relay {
  /**
   * @param {!hterm.Terminal.IO} io
   * @param {!Object} options
   * @param {!Location} location
   * @param {!lib.Storage} storage
   * @param {!LocalPreferenceManager} localPrefs
   * @override
   */
  constructor(io, options, location, storage, localPrefs) {
    super(io, options, location, storage, localPrefs);
    this.sshAgent_ = options['--ssh-agent'] || getGoogleSshAgentExtension();
    this.relayServer = `wss://${this.proxyHost}:${this.proxyPort}`;
  }

  /** @override */
  redirect() {
    // This shouldn't be called in the first place.
    throw new Error('ssh-fe does not redirect');
  }

  /**
   * @return {!Promise<boolean>}
   * @override
   */
  async init() {
    // Most init happens in the stream below.
    return true;
  }

  /**
   * @return {!Object}
   * @override
   */
  saveState() { return {}; }

  /**
   * @param {!Object} state
   * @override
   */
  loadState(state) {}

  /**
   * @param {string} host
   * @param {number} port
   * @return {!Promise<!Stream>}
   * @override
   */
  async openSocket(host, port) {
    const settings = {
      io: this.io_,
      relayHost: this.proxyHost,
      relayPort: this.proxyPort,
      relayUser: this.username,
      host: host,
      port: port,
      sshAgent: this.sshAgent_,
    };
    const stream = new RelaySshfeWsStream();
    await stream.open(settings);
    return stream;
  }
}
