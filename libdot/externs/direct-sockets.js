// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Externs definition for the Direct Sockets API.
 * @see https://wicg.github.io/direct-sockets/
 * @externs
 */

/**
 * @see https://wicg.github.io/direct-sockets/#tcpsocket-interface
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

/**
 * @see https://wicg.github.io/direct-sockets/#udpsocket-interface
 */
class UDPSocket {
  /**
   * @param {!UDPSocket.UDPSocketOptions} options
   */
  constructor(options) {
    /** @type {Promise<UDPSocket.UDPSocketOpenInfo>} */
    this.opened;

    /** @type {Promise<void>} */
    this.closed;
  }

  close() {}
}

/**
 * @typedef {{
 *   remoteAddress: (string|undefined),
 *   remotePort: (number|undefined),
 *   localAddress: (string|undefined),
 *   localPort: (number|undefined),
 * }}
 */
UDPSocket.UDPSocketOptions;

/**
 * @typedef {{
 *   readable: ReadableStream<UDPSocket.UDPMessage>,
 *   writable: WritableStream<UDPSocket.UDPMessage>,
 *   remoteAddress: string,
 *   remotePort: number,
 *   localAddress: string,
 *   localPort: number,
 * }}
 */
UDPSocket.UDPSocketOpenInfo;

/**
 * @typedef {{
 *   data: ArrayBuffer,
 *   remoteAddress: string,
 *   remotePort: number,
 * }}
 */
UDPSocket.UDPMessage;

/**
 * @see https://wicg.github.io/direct-sockets/#tcpserversocket-interface
 */
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
