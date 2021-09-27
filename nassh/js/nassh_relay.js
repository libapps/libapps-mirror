// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Common relay logic.
 */

nassh.relay = {};

/**
 * Interface that all relays must implement.
 *
 * @abstract
 */
nassh.Relay = class {
  /**
   * @param {!hterm.Terminal.IO} io Interface for showing updates.  Only output
   *     via print or overlays is utilized.
   * @param {!Object} options Command line options controlling proxy behavior.
   * @param {!Location} location Interface for redirecting to auth pages.
   * @param {!Storage} storage Temporary storage for relays when redirecting.
   *     Should be sessionStorage or equiv lifespan & isolation.
   */
  constructor(io, options, location, storage) {
    /** @type {!hterm.Terminal.IO} */
    this.io_ = io;
    /** @type {string} */
    this.proxyHost = options['--proxy-host'];
    /** @type {number} */
    this.proxyPort = options['--proxy-port'] || this.defaultProxyPort;
    /** @type {string} */
    this.username = options['--proxy-user'];
    /** @type {boolean} */
    this.resumeConnection = !!options['--resume-connection'];
    /** @type {!Location} */
    this.location = location;
    /** @type {!Storage} */
    this.storage = storage;
  }

  /**
   * Redirect to the relay lookup server to initialize the connection.
   *
   * Can be used for auth purposes.
   *
   * @abstract
   * @return {boolean} Whether redirection was successful.
   */
  redirect() {}

  /**
   * Initialize this relay object.
   *
   * If we haven't just come back from the cookie server, then this function
   * will redirect to the cookie server and return false.
   *
   * If we have just come back from the cookie server, then we'll return true.
   *
   * @abstract
   * @return {!Promise<boolean>} Whether we're ready (true), or we need a
   *     redirect.
   */
  async init() {}

  /**
   * Return an nassh.Stream object that will handle the socket stream
   * for this relay.
   *
   * @abstract
   * @param {number} fd
   * @param {string} host
   * @param {number} port
   * @param {!nassh.StreamSet} streams
   * @param {function(boolean, ?string=)} onOpen
   * @return {!nassh.Stream}
   */
  openSocket(fd, host, port, streams, onOpen) {}

  /**
   * Save all the relevant state after a relay has finished initializing.
   *
   * This can be used to cache or pass relay information to other pages.
   * The result is guaranteed to be JSON serializable.
   *
   * @abstract
   * @return {!Object} The relay state.
   */
  saveState() {}

  /**
   * Restore all relevant relay state.
   *
   * The data here comes from saveState and is opaque to the caller.
   * Once restored, we know init() & redirect() have "finished".
   *
   * @abstract
   * @param {!Object} state The relay state.
   */
  loadState(state) {}
};

/**
 * The default proxy server port.
 *
 * TODO(vapier): Move to class fields once JS+closure-compiler support it.
 *
 * @type {number}
 */
nassh.Relay.prototype.defaultProxyPort = 443;
