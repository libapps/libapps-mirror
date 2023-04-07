// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Externs definition for the Direct Sockets API.
 * @see https://wicg.github.io/direct-sockets/
 * @externs
 */

class TCPSocket {
  /**
   * @param {string} remoteAddress
   * @param {number} remotePort
   * @param {TCPSocket.TcpSocketOptions} options
   */
  constructor(remoteAddress, remotePort, options) {
    /** @type {Promise<TCPSocket.TCPSocketOpenInfo>} */
    this.opened;

    /** @type {Promise<void>} */
    this.closed;
  }

  close() {}
}

/**
 * @typedef {{
 *   readable: ReadableStream<ArrayBuffer>,
 *   writable: WritableStream<ArrayBuffer>,
 *   remoteAddress: string,
 *   remotePort: number,
 *   localAddress: string,
 *   localPort: number,
 * }}
 */
TCPSocket.TCPSocketOpenInfo;

/**
 * @typedef {{
 *   sendBufferSize: (number|undefined),
 *   receiveBufferSize: (number|undefined),
 *   noDelay: (boolean|undefined),
 *   keepAliveDelay: (number|undefined),
 * }}
 */
TCPSocket.TcpSocketOptions;

class TCPServerSocket {
  /**
   * @param {string} localAddress
   * @param {TCPServerSocket.TcpServerSocketOptions} options
   */
  constructor(localAddress, options) {
    /** @type {Promise<TCPServerSocket.TCPServerSocketOpenInfo>} */
    this.opened;

    /** @type {Promise<void>} */
    this.closed;
  }

  close() {}
}

/**
 * @typedef {{
 *   readable: ReadableStream<TCPSocket>,
 *   localAddress: string,
 *   localPort: number,
 * }}
 */
TCPServerSocket.TCPServerSocketOpenInfo;

/**
 * @typedef {{
 *   localPort: (number|undefined),
 *   backlog: (number|undefined),
 *   ipv6Only: (boolean|undefined),
 * }}
 */
TCPServerSocket.TcpServerSocketOptions;
