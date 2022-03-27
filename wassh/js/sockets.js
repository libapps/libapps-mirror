// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Sockets emulation layers.
 * @suppress {moduleLoad}
 */

import * as WASI from '../../wasi-js-bindings/js/wasi.js';
import * as VFS from './vfs.js';

// const AF_UNSPEC = 0;
export const AF_INET = 1;
export const AF_INET6 = 2;
export const AF_UNIX = 3;

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
}

/**
 * A TCP/IP based socket.
 */
export class TcpSocket extends Socket {
  /**
   * @param {number} domain
   * @param {number} type
   * @param {number} protocol
   */
  constructor(domain, type, protocol) {
    super(domain, type, protocol);

    /** @type {number} */
    this.socketId = -1;

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

    this.socketId = info.socketId;
  }

  /** @override */
  async connect(address, port) {
    if (this.address !== null) {
      return WASI.errno.EISCONN;
    }

    const result = await new Promise((resolve) => {
      chrome.sockets.tcp.connect(this.socketId, address, port, resolve);
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
    // any errors here.  We wait for the disconnect only so that we can reset
    // the internal state, but we could probably hoist that out if we wanted.
    await new Promise((resolve) => {
      chrome.sockets.tcp.disconnect(this.socketId, () => {
        chrome.sockets.tcp.close(this.socketId);
        this.socketId = -1;
        this.address = null;
        this.port = null;
        resolve();
      });
    });
  }

  /** @override */
  async write(buf) {
    const {result, bytesSent} = await new Promise((resolve) => {
      // TODO(vapier): Double check whether send accepts TypedArrays directly.
      // Or if we have to respect buf.byteOffset & buf.byteLength ourself.
      chrome.sockets.tcp.send(this.socketId, buf.buffer, resolve);
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
      chrome.sockets.tcp.getInfo(this.socketId, resolve);
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
              chrome.sockets.tcp.setKeepAlive(this.socketId, !!value, resolve);
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
              chrome.sockets.tcp.setNoDelay(this.socketId, !!value, resolve);
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
    this.callback_.asyncWrite(buf);
    return {nwritten: buf.length};
  }
}
