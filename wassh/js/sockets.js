// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Sockets emulation layers.
 * @suppress {moduleLoad}
 */

import * as WASI from '../../wasi-js-bindings/js/wasi.js';
import * as VFS from './vfs.js';

const SOL_SOCKET = 0x7fffffff;
// const SO_RCVBUF sets bufferSize.
const SO_KEEPALIVE = 9;
const IPPROTO_IP = 0;
const IP_TOS = 1;
const IPPROTO_TCP = 6;
const TCP_NODELAY = 1;

/**
 * Base class for all socket types.
 *
 * This should support TCP/UDP/UNIX/etc... fundamentals without having any
 * family or protocol specific logic in it.
 */
export class Socket extends VFS.PathHandle {
  /**
   * @param {number} domain
   * @param {number} type
   * @param {number} protocol
   */
  constructor(domain, type, protocol) {
    super('socket', type);
    /** @const {number} */
    this.domain = domain;
    /** @const {number} */
    this.protocol = protocol;
    /** @type {?string} */
    this.address = null;
    /** @type {?number} */
    this.port = null;
    /** @type {?function()} */
    this.receiveListener_ = null;

    // TODO(vapier): Make this into a stream.
    this.data = new Uint8Array(0);

    // Callback when the read is blocking.
    this.reader_ = null;
  }

  /**
   * @param {string} address
   * @param {number} port
   * @return {!Promise<!WASI_t.errno>}
   */
  async connect(address, port) {
    throw new Error('connect(): unimplemented');
  }

  /**
   * @param {!ArrayBuffer} data
   */
  onRecv(data) {
    const u8 = new Uint8Array(data);
    const newData = new Uint8Array(this.data.length + u8.length);
    newData.set(this.data);
    newData.set(u8, this.data.length);
    this.data = newData;

    // If there are any readers waiting, wake them up.
    if (this.reader_) {
      this.reader_();
      this.reader_ = null;
    }

    if (this.receiveListener_) {
      this.receiveListener_();
    }
  }

  /** @override */
  async read(length) {
    // TODO(vapier): Support O_NONBLOCK.
    if (this.data.length === 0) {
      await new Promise((resolve) => this.reader_ = resolve);
    }

    const buf = this.data.slice(0, length);
    this.data = this.data.subarray(length);
    return {buf};
  }

  /** @override */
  stat() {
    return /** @type {!WASI_t.filestat} */ ({
      fs_filetype: this.filetype,
      fs_rights_base:
          WASI.rights.FD_READ |
          WASI.rights.FD_WRITE |
          WASI.rights.POLL_FD_READWRITE |
          WASI.rights.SOCK_SHUTDOWN,
    });
  }

  /**
   * Registers a listener that will be called when data is recieved on the
   * socket.
   *
   * @param {?function()} listener
   */
  setReceiveListener(listener) {
    this.receiveListener_ = listener;
  }
}

/**
 * A TCP/IP based socket backed by the chrome.sockets.tcp API.
 */
export class ChromeTcpSocket extends Socket {
  /**
   * @param {number} domain
   * @param {number} type
   * @param {number} protocol
   */
  constructor(domain, type, protocol) {
    super(domain, type, protocol);

    /** @type {number} */
    this.socketId_ = -1;

    this.tcpKeepAlive_ = false;
    this.tcpNoDelay_ = false;
  }

  /** @override */
  async init() {
    if (!window.chrome || !chrome.sockets || !chrome.sockets.tcp) {
      return;
    }

    const info = await new Promise((resolve) => {
      chrome.sockets.tcp.create(resolve);
    });

    this.socketId_ = info.socketId;

    if (ChromeTcpSocket.eventRouter_ === null) {
      ChromeTcpSocket.eventRouter_ = new ChromeTcpSocketEventRouter();
    }

    ChromeTcpSocket.eventRouter_.register(this.socketId_, this);
  }

  /** @override */
  async connect(address, port) {
    if (this.address !== null) {
      return WASI.errno.EISCONN;
    }

    const result = await new Promise((resolve) => {
      chrome.sockets.tcp.connect(this.socketId_, address, port, resolve);
    });

    switch (result) {
      case 0:
        this.address = address;
        this.port = port;
        return WASI.errno.ESUCCESS;
      case -102:
        return WASI.errno.ECONNREFUSED;
      default:
        // NB: Should try to translate these error codes.
        return WASI.errno.ENETUNREACH;
    }
  }

  /** @override */
  async close() {
    // In the *NIX world, close must never fail.  That's why we don't return
    // any errors here.

    if (this.socketId_ === -1) {
      return;
    }

    // If a socket was created but not connected, we can't disconnect it, but we
    // need to stiil close it.
    if (this.address) {
      // We wait for the disconnect only so that we can reset the internal
      // state below, but we could probably wait for the close too if needed.
      await new Promise((resolve) => {
        chrome.sockets.tcp.disconnect(this.socketId_, resolve);
      });
    }

    chrome.sockets.tcp.close(this.socketId_);
    ChromeTcpSocket.eventRouter_.unregister(this.socketId_);

    this.socketId_ = -1;
    this.address = null;
    this.port = null;
  }

  /** @override */
  async write(buf) {
    const {result, bytesSent} = await new Promise((resolve) => {
      // TODO(vapier): Double check whether send accepts TypedArrays directly.
      // Or if we have to respect buf.byteOffset & buf.byteLength ourself.
      chrome.sockets.tcp.send(this.socketId_, buf.buffer, resolve);
    });

    if (result < 0) {
      // NB: Should try to translate these error codes.
      return WASI.errno.EINVAL;
    }

    return {nwritten: bytesSent};
  }

  /**
   * @return {!Promise<!chrome.socket.SocketInfo>}
   */
  async getSocketInfo() {
    return new Promise((resolve) => {
      chrome.sockets.tcp.getInfo(this.socketId_, resolve);
    });
  }

  /**
   * @param {number} level
   * @param {number} name
   * @return {!Promise<{option: number}>}
   */
  async getSocketOption(level, name) {
    switch (level) {
      case SOL_SOCKET: {
        switch (name) {
          case SO_KEEPALIVE:
            return {option: this.tcpKeepAlive_ ? 1 : 0};
        }
        break;
      }

      case IPPROTO_TCP: {
        switch (name) {
          case TCP_NODELAY:
            return {option: this.tcpNoDelay_ ? 1 : 0};
        }
        break;
      }
    }

    return WASI.errno.ENOPROTOOPT;
  }

  /**
   * @param {number} level
   * @param {number} name
   * @param {number} value
   * @return {!Promise<!WASI_t.errno>}
   */
  async setSocketOption(level, name, value) {
    switch (level) {
      case SOL_SOCKET: {
        switch (name) {
          case SO_KEEPALIVE: {
            const result = await new Promise((resolve) => {
              chrome.sockets.tcp.setKeepAlive(this.socketId_, !!value, resolve);
            });
            if (result < 0) {
              console.warn(`setKeepAlive(${value}) failed with ${result})`);
              return WASI.errno.EINVAL;
            }
            this.tcpKeepAlive_ = value;
            return WASI.errno.ESUCCESS;
          }
        }
        break;
      }

      case IPPROTO_IP: {
        switch (name) {
          case IP_TOS: {
            // TODO(vapier): Try and extend Chrome sockets API to support this.
            console.warn(`Ignoring IP_TOS=${value}`);
            return WASI.errno.ESUCCESS;
          }
        }
        break;
      }

      case IPPROTO_TCP: {
        switch (name) {
          case TCP_NODELAY: {
            const result = await new Promise((resolve) => {
              chrome.sockets.tcp.setNoDelay(this.socketId_, !!value, resolve);
            });
            if (result < 0) {
              console.warn(`setNoDelay(${value}) failed with ${result})`);
              return WASI.errno.EINVAL;
            }
            this.tcpNoDelay_ = value;
            return WASI.errno.ESUCCESS;
          }
        }
        break;
      }
    }

    return WASI.errno.ENOPROTOOPT;
  }
}

/**
 * Used to route receive events to all ChromeTcpSockets.
 *
 * @type {?ChromeTcpSocketEventRouter}
 */
ChromeTcpSocket.eventRouter_ = null;

/**
 * A TCP/IP based socket backed by a Stream. Used to connect to a relay server.
 */
export class RelaySocket extends Socket {
  /**
   * @param {number} domain
   * @param {number} type
   * @param {number} protocol
   * @param {function(string, number)} open
   */
  constructor(domain, type, protocol, open) {
    super(domain, type, protocol);

    this.open_ = open;

    this.callback_ = null;

    this.tcpKeepAlive_ = false;
    this.tcpNoDelay_ = false;
  }

  /** @override */
  async connect(address, port) {
    if (this.address !== null) {
      return WASI.errno.EISCONN;
    }

    this.callback_ = await this.open_(address, port);

    if (!this.callback_) {
      console.error('Unable to connect to relay server.');
      return WASI.errno.EIO;
    }

    this.callback_.onDataAvailable = (data) => this.onRecv(data);
    this.address = address;
    this.port = port;
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  async close() {
    // In the *NIX world, close must never fail.  That's why we don't return
    // any errors here.

    if (this.callback_) {
      this.callback_.close();
      this.callback_ = null;
    }

    this.address = null;
    this.port = null;
  }

  /** @override */
  async write(buf) {
    await this.callback_.asyncWrite(buf);
    return {nwritten: buf.length};
  }

  /**
   * @return {!Promise<!chrome.socket.SocketInfo>}
   */
  async getSocketInfo() {
    // Return a stub socketInfo since we can't extract the required info
    // out of a WebSocket.
    return /** @type {!chrome.socket.SocketInfo} **/ ({
      connected: (this.address !== null),
      paused: false,
      persistent: false,
      localAddress: '0.0.0.0',
      localPort: 0,
      peerAddress: '0.0.0.0',
      peerPort: this.port,
      socketId: -1,
    });
  }

  /**
   * @param {number} level
   * @param {number} name
   * @return {!Promise<{option: number}>}
   */
  async getSocketOption(level, name) {
    switch (level) {
      case SOL_SOCKET: {
        switch (name) {
          case SO_KEEPALIVE:
            return {option: this.tcpKeepAlive_ ? 1 : 0};
        }
        break;
      }

      case IPPROTO_TCP: {
        switch (name) {
          case TCP_NODELAY:
            return {option: this.tcpNoDelay_ ? 1 : 0};
        }
        break;
      }
    }

    return WASI.errno.ENOPROTOOPT;
  }

  /**
   * @param {number} level
   * @param {number} name
   * @param {number} value
   * @return {!Promise<!WASI_t.errno>}
   */
  async setSocketOption(level, name, value) {
    switch (level) {
      case SOL_SOCKET: {
        switch (name) {
          case SO_KEEPALIVE: {
            this.tcpKeepAlive_ = value;
            return WASI.errno.ESUCCESS;
          }
        }
        break;
      }

      case IPPROTO_IP: {
        switch (name) {
          case IP_TOS: {
            console.warn(`Ignoring IP_TOS=${value}`);
            return WASI.errno.ESUCCESS;
          }
        }
        break;
      }

      case IPPROTO_TCP: {
        switch (name) {
          case TCP_NODELAY: {
            this.tcpNoDelay_ = value;
            return WASI.errno.ESUCCESS;
          }
        }
        break;
      }
    }

    return WASI.errno.ENOPROTOOPT;
  }
}

/**
 * A local/UNIX socket.
 */
export class UnixSocket extends Socket {
  /**
   * @param {number} domain
   * @param {number} type
   * @param {number} protocol
   * @param {function(string, number)} open
   */
  constructor(domain, type, protocol, open) {
    super(domain, type, protocol);
    this.open_ = open;
    /**
     * @type {?{
     *   asyncWrite: function(!TypedArray),
     *   close: function(),
     * }}
     */
    this.callback_ = null;
  }

  /** @override */
  async connect(address, port) {
    if (this.address !== null) {
      return WASI.errno.EISCONN;
    }

    this.callback_ = await this.open_(address, port);
    if (!this.callback_) {
      return WASI.errno.ECONNREFUSED;
    }

    this.address = address;
    this.port = port;
    this.callback_.onDataAvailable = (data) => this.onRecv(data);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  async close() {
    // In the *NIX world, close must never fail.  That's why we don't return
    // any errors here.
    if (this.address === null) {
      return;
    }

    this.callback_.close();
    this.address = null;
    this.port = null;
    this.callback_ = null;
  }

  /** @override */
  async write(buf) {
    await this.callback_.asyncWrite(buf);
    return {nwritten: buf.length};
  }
}

/**
 * Maps socketIds to sockets and forwards data received to the sockets.
 */
class ChromeTcpSocketEventRouter {
  constructor() {
    this.socketMap_ = new Map();

    const socketTcpRecv = this.onSocketTcpRecv_.bind(this);
    chrome.sockets.tcp.onReceive.addListener(socketTcpRecv);
  }

  /**
   * Registers the given ChromeTcpSocket with the router.
   *
   * Sockets must be registered in order to be notified when they receive
   * data.
   *
   * @param {number} socketId
   * @param {!ChromeTcpSocket} socket
   */
  register(socketId, socket) {
    this.socketMap_.set(socketId, socket);
  }

  /**
   * Unregisters the ChromeTcpSocket with the given ID from the router.
   *
   * @param {number} socketId
   */
  unregister(socketId) {
    this.socketMap_.delete(socketId);
  }

  /**
   * The onReceive listener for the chrome.sockets API which forwards data to
   * the associated ChromeTcpSocket.
   *
   * @param {{socketId: number, data: !ArrayBuffer}} options
   */
  onSocketTcpRecv_({socketId, data}) {
    const handle = this.socketMap_.get(socketId);
    if (handle === undefined) {
      console.warn(`Data received for unknown socket ${socketId}`);
      return;
    }

    handle.onRecv(data);
  }
}
