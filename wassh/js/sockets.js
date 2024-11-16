// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Sockets emulation layers.
 * @suppress {moduleLoad}
 */

import * as WASI from '../../wasi-js-bindings/js/wasi.js';
import * as NetErrorList from './chrome_net_error_list.js';
import * as Constants from './constants.js';
import * as VFS from './vfs.js';

const SOL_SOCKET = 0x7fffffff;
// const SO_RCVBUF sets bufferSize.
const SO_REUSEADDR = 2;
const SO_ERROR = 4;
const SO_KEEPALIVE = 9;
const IPPROTO_IP = 0;
const IPPROTO_IPV6 = 41;
const IP_TOS = 1;
const IPPROTO_TCP = 6;
const TCP_NODELAY = 1;
const IPV6_TCLASS = 67;
// Time (seconds) for default keep alive intervals.  This matches Linux.
const TCP_KEEPALIVE_INTVL = 75;

/**
 * Map Chrome net errors to errno values when possible.
 */
const CHROME_NET_ERROR_TO_ERRNO = {
  // NB: Sorted by NetErrorList value.
  [NetErrorList.INVALID_ARGUMENT]: WASI.errno.EINVAL,
  [NetErrorList.TIMED_OUT]: WASI.errno.ETIMEDOUT,
  [NetErrorList.SUCCESS]: WASI.errno.ESUCCESS,
  [NetErrorList.CONNECTION_REFUSED]: WASI.errno.ECONNREFUSED,
  [NetErrorList.NAME_NOT_RESOLVED]: WASI.errno.EHOSTUNREACH,
  [NetErrorList.ADDRESS_IN_USE]: WASI.errno.EADDRINUSE,
};

/**
 * Convert an error from the Chrome network layers to an errno.
 *
 * Chrome doesn't seem to expose this anywhere.
 *
 * @param {number} err The Chrome network error.
 * @return {number} The translated errno value.
 */
function netErrorToErrno(err) {
  const ret = CHROME_NET_ERROR_TO_ERRNO[err];
  if (ret !== undefined) {
    return ret;
  }
  return WASI.errno.ENOTRECOVERABLE;
}

/**
 * Clear "last error" if available.
 *
 * Some Chrome APIs set the last error field in addition to returning an error,
 * and if it isn't cleared, then it will throw confusing errors in the console.
 *
 * @suppress {uselessCode}
 */
function clearLastError() {
  globalThis.chrome?.runtime?.lastError;
}

/**
 * Convert string IP address to bytes.
 *
 * This is like the inet_pton() API, but we detect IPv4 vs IPv6.
 *
 * @param {string} strAddress The IP address.
 * @return {!Array<number>} The IP address bytes.
 */
export function strAddrToArray(strAddress) {
  let address;

  if (strAddress.includes('.')) {
    address = strAddress.split('.').map((x) => parseInt(x, 10));
  } else {
    // Need to handle compressed :: ourselves.
    let parts = strAddress.split(':');
    const firstEmpty = parts.indexOf('');
    if (firstEmpty !== -1) {
      const zeros = ['0', '0', '0', '0', '0', '0', '0', '0'];
      const lastEmpty = parts.lastIndexOf('');
      parts = parts.slice(0, firstEmpty).concat(
          zeros.slice(parts.length - (lastEmpty - firstEmpty + 1))).concat(
          parts.slice(lastEmpty + 1));
    }

    // Turn 8 16-bits into 16 8-bits.
    address = [];
    parts.forEach((s) => {
      const o = parseInt(s, 16);
      address.push((o & 0xff00) >> 8);
      address.push(o & 0xff);
    });
  }

  return address;
}

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

    // Callback when the read is blocking.
    this.reader_ = null;
  }

  /** @override */
  toString() {
    return `${this.constructor.name}(${this.address}:${this.port}, ` +
        `domain=${this.domain}, protocol=${this.protocol})`;
  }

  debug(...args) {
    console.debug('socket', ...args);
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
    throw new Error('onData(): unimplemented');
  }

  /** @override */
  async stat() {
    return /** @type {!WASI_t.fdstat} */ ({
      fs_filetype: this.filetype,
      fs_rights_base:
          WASI.rights.FD_READ |
          WASI.rights.FD_WRITE |
          WASI.rights.POLL_FD_READWRITE |
          WASI.rights.SOCK_SHUTDOWN,
    });
  }

  /**
   * Send data to a specific address/port.
   *
   * @param {!ArrayBuffer} buf The data to send.
   * @param {string} address The system to send to.
   * @param {number} port The port to send to.
   * @return {!Promise<!WASI_t.errno|{nwritten: number}>}
   */
  async sendto(buf, address, port) {
    throw new Error('sendto(): unimplemented');
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

  /**
   * @return {!Promise<!WASI_t.errno|!Socket>}
   */
  async accept() {
    return WASI.errno.EINVAL;
  }

  /**
   * @param {string} address
   * @param {number} port
   * @return {!Promise<!WASI_t.errno|!Socket>}
   */
  async bind(address, port) {
    return WASI.errno.EINVAL;
  }

  /**
   * @param {number} backlog
   * @return {!Promise<!WASI_t.errno>}
   */
  async listen(backlog) {
    return WASI.errno.EINVAL;
  }

  /**
   * @param {number} level
   * @param {number} name
   * @return {!Promise<!WASI_t.errno|{option: number}>}
   */
  async getSocketOption(level, name) {
    return WASI.errno.ENOPROTOOPT;
  }

  /**
   * @param {number} level
   * @param {number} name
   * @param {number} value
   * @return {!Promise<!WASI_t.errno>}
   */
  async setSocketOption(level, name, value) {
    return WASI.errno.ENOPROTOOPT;
  }

  /**
   * Checks if the API is available to use.
   *
   * @return {boolean}
   */
  static isSupported() {
    return true;
  }
}

/**
 * Base class for all stream socket types.
 */
export class StreamSocket extends Socket {
  /** @override */
  constructor(domain, type, protocol) {
    super(domain, type, protocol);

    // TODO(vapier): Make this into a stream.
    this.data = new Uint8Array(0);
  }

  /** @override */
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
  async read(length, block = true) {
    if (this.data.length === 0) {
      if (!block) {
        return WASI.errno.EAGAIN;
      }
      await new Promise((resolve) => this.reader_ = resolve);
    }

    const buf = this.data.slice(0, length);
    this.data = this.data.subarray(length);
    return {buf};
  }
}

/**
 * Base class for all datagram (packet) socket types.
 */
export class DatagramSocket extends Socket {
  /** @override */
  constructor(domain, type, protocol) {
    super(domain, type, protocol);

    this.data = [];
  }

  /** @override */
  onRecv(data) {
    this.data.push(new Uint8Array(data));

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
  async read(length, block = true) {
    if (this.data.length === 0) {
      if (!block) {
        return WASI.errno.EAGAIN;
      }
      await new Promise((resolve) => this.reader_ = resolve);
    }

    // Packets have to be read completely, one at a time.
    if (this.data[0].byteLength > length) {
      return WASI.errno.ENOMEM;
    }

    return {buf: this.data.shift()};
  }
}

/**
 * Construct a name for tracking Chrome sockets.
 *
 * See cleanupChromeSockets below for more details.
 *
 * @return {!Promise<string>}
 */
async function getChromeSocketsName() {
  const {id} = await new Promise((resolve) => chrome.tabs.getCurrent(resolve));
  return `tabid:${id}`;
}

/**
 * Check to see if a tab still exists.
 *
 * @param {number} id The tab id.
 * @return {!Promise<boolean>} Whether the tab exists.
 */
async function checkChromeTab(id) {
  const tab = await new Promise((resolve) => chrome.tabs.get(id, resolve));
  if (tab === undefined) {
    clearLastError();
    return false;
  }
  return true;
}

/**
 * Cleanup orphaned Chrome sockets.
 *
 * Walk all open Chrome sockets and check which tab they're associated with.  If
 * the tab no longer exists, close it.  If the socket is associated with the
 * current tab, it's from a previous run and should be closed too.
 *
 * We track the tab via each socket's name field that is set when creating it.
 * See getChromeSocketsName for the simple format we use.
 *
 * @return {!Promise<void>}
 */
export async function cleanupChromeSockets() {
  const {id} = await new Promise((resolve) => chrome.tabs.getCurrent(resolve));
  const promises = [];
  const cleanup = (api) => {
    const closeSocket = (socket) => {
      return new Promise((resolve) => api.close(socket, resolve));
    };

    return new Promise((resolve) => {
      api.getSockets((sockets) => {
        sockets.forEach((socket) => {
          const name = socket.name || '';
          const ele = name.split(':');
          if (ele[0] !== 'tabid' || ele[1] === `${id}`) {
            // Close unknown sockets and sockets that belonged to this tab in a
            // previous run.
            promises.push(closeSocket(socket.socketId));
          } else {
            // Close sockets whose tabs no longer exist.
            promises.push(
                checkChromeTab(parseInt(ele[1], 10)).then((exists) => {
                  if (!exists) {
                    return closeSocket(socket.socketId);
                  }
                }));
          }
        });
        resolve();
      });
    });
  };
  await cleanup(chrome.sockets.tcp);
  await cleanup(chrome.sockets.tcpServer);
  await cleanup(chrome.sockets.udp);
  await Promise.all(promises);
}

/**
 * A TCP/IP based socket backed by the chrome.sockets.tcp API.
 */
export class ChromeTcpSocket extends StreamSocket {
  /** @override */
  constructor(domain, type, protocol) {
    super(domain, type, protocol);

    /** @type {number} */
    this.socketId_ = -1;

    this.tcpKeepAlive_ = false;
    this.tcpNoDelay_ = false;
  }

  /** @override */
  async init(socketId = undefined) {
    if (socketId === undefined) {
      const info = await new Promise(async (resolve) => {
        chrome.sockets.tcp.create({
          name: await getChromeSocketsName(),
          bufferSize: 64 * 1024,
        }, resolve);
      });

      this.socketId_ = info.socketId;
    } else {
      this.socketId_ = socketId;
    }

    if (ChromeTcpSocket.eventRouter_ === null) {
      ChromeTcpSocket.eventRouter_ = new ChromeTcpSocketEventRouter();
    }

    ChromeTcpSocket.eventRouter_.register(this.socketId_, this);
  }

  /** @override */
  async connect(address, port) {
    this.debug(`connect(${address}, ${port})`);

    if (this.address !== null) {
      return WASI.errno.EISCONN;
    }

    const result = await new Promise((resolve) => {
      let addrType;
      switch (this.domain) {
        case Constants.AF_INET:
          addrType = 'ipv4';
          break;
        case Constants.AF_INET6:
          addrType = 'ipv6';
          break;
      }
      chrome.sockets.tcp.connect(
          this.socketId_, address, port, addrType, resolve);
    });

    const ret = netErrorToErrno(result);
    if (ret !== WASI.errno.ESUCCESS) {
      clearLastError();
      return ret;
    }

    this.address = address;
    this.port = port;
    return ret;
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
    const {resultCode, bytesSent} = await new Promise((resolve) => {
      // TODO(vapier): Double check whether send accepts TypedArrays directly.
      // Or if we have to respect buf.byteOffset & buf.byteLength ourself.
      chrome.sockets.tcp.send(this.socketId_, buf.buffer, resolve);
    });

    const ret = netErrorToErrno(resultCode);
    if (ret !== WASI.errno.ESUCCESS) {
      clearLastError();
      return ret;
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

  /** @override */
  async bind(address, port) {
    const handle = new ChromeTcpListenSocket(
        this.domain, this.filetype, this.protocol);
    await handle.init();
    const result = await handle.bind(address, port);
    if (result !== 0) {
      handle.close();
      return result;
    }
    return handle;
  }

  /** @override */
  async getSocketOption(level, name) {
    switch (level) {
      case SOL_SOCKET: {
        switch (name) {
          case SO_ERROR: {
            // TODO(vapier): This should return current connection state.
            return {option: 0};
          }

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

  /** @override */
  async setSocketOption(level, name, value) {
    switch (level) {
      case SOL_SOCKET: {
        switch (name) {
          case SO_KEEPALIVE: {
            const result = await new Promise((resolve) => {
              chrome.sockets.tcp.setKeepAlive(
                  this.socketId_, !!value, TCP_KEEPALIVE_INTVL, resolve);
            });
            if (result < 0) {
              console.warn(`setKeepAlive(${value}) failed with ${result})`);
              return WASI.errno.EINVAL;
            }
            this.tcpKeepAlive_ = value;
            return WASI.errno.ESUCCESS;
          }

          case SO_REUSEADDR: {
            // TODO(vapier): Try and extend Chrome sockets API to support this.
            console.warn(`Ignoring SO_REUSEADDR=${value}`);
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

      case IPPROTO_IPV6: {
        switch (name) {
          case IPV6_TCLASS: {
            // TODO(vapier): Try and extend Chrome sockets API to support this.
            console.warn(`Ignoring IPV6_TCLASS=${value}`);
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

  /** @override */
  static isSupported() {
    return window?.chrome?.sockets?.tcp !== undefined;
  }
}

/**
 * Used to route receive events to all ChromeTcpSockets.
 *
 * @type {?ChromeTcpSocketEventRouter}
 */
ChromeTcpSocket.eventRouter_ = null;

/**
 * A TCP/IP based listening socket backed by the chrome.sockets.tcpServer API.
 */
export class ChromeTcpListenSocket extends StreamSocket {
  /** @override */
  constructor(domain, type, protocol) {
    super(domain, type, protocol);

    /** @type {number} */
    this.socketId_ = -1;

    /** @type {!Array<!ChromeTcpSocket>} */
    this.clients_ = [];
    this.callback_ = null;
  }

  /** @override */
  async init() {
    const info = await new Promise(async (resolve) => {
      chrome.sockets.tcpServer.create({
        name: await getChromeSocketsName(),
      }, resolve);
    });

    this.socketId_ = info.socketId;

    if (ChromeTcpListenSocket.eventRouter_ === null) {
      ChromeTcpListenSocket.eventRouter_ =
          new ChromeTcpListenSocketEventRouter();
    }

    ChromeTcpListenSocket.eventRouter_.register(this.socketId_, this);
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
        chrome.sockets.tcpServer.disconnect(this.socketId_, resolve);
      });
    }

    chrome.sockets.tcpServer.close(this.socketId_);
    ChromeTcpListenSocket.eventRouter_.unregister(this.socketId_);

    this.socketId_ = -1;
    this.address = null;
    this.port = null;
  }

  /**
   * @return {!Promise<!chrome.socket.SocketInfo>}
   */
  async getSocketInfo() {
    return new Promise((resolve) => {
      chrome.sockets.tcpServer.getInfo(this.socketId_, resolve);
    });
  }

  /** @override */
  async accept() {
    const result = this.clients_.shift();
    if (result !== undefined) {
      return result;
    }

    return new Promise((resolve) => {
      this.callback_ = () => {
        resolve(this.clients_.shift());
        this.callback_ = null;
      };
    });
  }

  /**
   * @param {number} socketId
   */
  async onAccept(socketId) {
    const handle = new ChromeTcpSocket(
        this.domain, this.filetype, this.protocol);
    await handle.init(socketId);
    this.clients_.push(handle);
    if (this.callback_) {
      this.callback_();
    }

    // The Chrome API pauses new sockets by default, so unpause them.
    await new Promise((resolve) => {
      chrome.sockets.tcp.setPaused(socketId, false, resolve);
    });

    if (this.receiveListener_) {
      this.receiveListener_();
    }
  }

  /** @override */
  async bind(address, port) {
    if (this.address !== null) {
      return WASI.errno.EADDRINUSE;
    }

    this.address = address;
    this.port = port;
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  async listen(backlog) {
    const result = await new Promise((resolve) => {
      // If the caller hasn't called bind(), then POSIX tries to bind a random
      // address with a random port.  If those fail, it returns EADDRINUSE.  We
      // don't bother and immediately return EADDRINUSE.  This isn't exactly
      // correct, but it's also not exactly incorrect.
      if (this.address === null || this.port === null) {
        resolve(NetErrorList.ADDRESS_IN_USE);
        return;
      }

      chrome.sockets.tcpServer.listen(
          this.socketId_, this.address, this.port, backlog, resolve);
    });

    clearLastError();
    return netErrorToErrno(result);
  }

  /** @override */
  static isSupported() {
    return window?.chrome?.sockets?.tcpServer !== undefined;
  }
}

/**
 * Used to route receive events to all ChromeTcpListenSockets.
 *
 * @type {?ChromeTcpListenSocketEventRouter}
 */
ChromeTcpListenSocket.eventRouter_ = null;

/**
 * A UDP/IP based socket backed by the chrome.sockets.udp API.
 */
export class ChromeUdpSocket extends DatagramSocket {
  /** @override */
  constructor(domain, type, protocol) {
    super(domain, type, protocol);

    /** @type {number} */
    this.socketId_ = -1;
  }

  /** @override */
  async init(socketId = undefined) {
    if (socketId === undefined) {
      const info = await new Promise(async (resolve) => {
        chrome.sockets.udp.create({
          name: await getChromeSocketsName(),
        }, resolve);
      });

      this.socketId_ = info.socketId;
    } else {
      this.socketId_ = socketId;
    }

    if (ChromeUdpSocket.eventRouter_ === null) {
      ChromeUdpSocket.eventRouter_ = new ChromeUdpSocketEventRouter();
    }

    ChromeUdpSocket.eventRouter_.register(this.socketId_, this);
  }

  /** @override */
  async close() {
    // In the *NIX world, close must never fail.  That's why we don't return
    // any errors here.

    if (this.socketId_ === -1) {
      return;
    }

    chrome.sockets.udp.close(this.socketId_);
    ChromeUdpSocket.eventRouter_.unregister(this.socketId_);

    this.socketId_ = -1;
    this.address = null;
    this.port = null;
  }

  /** @override */
  async sendto(buf, address, port) {
    // Chrome APIs require us to bind the socket locally first.
    if (this.address === null) {
      const bindRet = await this.bind('0.0.0.0', 0);
      if (typeof bindRet === 'number' && bindRet !== WASI.errno.ESUCCESS) {
        return bindRet;
      }
    }

    const {resultCode, bytesSent} = await new Promise((resolve) => {
      chrome.sockets.udp.send(this.socketId_, buf, address, port, resolve);
    });

    const ret = netErrorToErrno(resultCode);
    if (ret !== WASI.errno.ESUCCESS) {
      clearLastError();
      return ret;
    }

    return {nwritten: bytesSent};
  }

  /** @override */
  async bind(address, port) {
    if (this.address !== null) {
      return WASI.errno.EADDRINUSE;
    }

    const result = await new Promise((resolve) => {
      chrome.sockets.udp.bind(this.socketId_, address, port, resolve);
    });

    const ret = netErrorToErrno(result);
    if (ret !== WASI.errno.ESUCCESS) {
      clearLastError();
      return ret;
    }

    this.address = address;
    this.port = port;
    return WASI.errno.ESUCCESS;
  }

  /**
   * @return {!Promise<!chrome.socket.SocketInfo>}
   */
  async getSocketInfo() {
    return new Promise((resolve) => {
      chrome.sockets.udp.getInfo(this.socketId_, resolve);
    });
  }

  /** @override */
  static isSupported() {
    return window?.chrome?.sockets?.udp !== undefined;
  }
}

/**
 * Used to route receive events to all ChromeUdpSockets.
 *
 * @type {?ChromeUdpSocketEventRouter}
 */
ChromeUdpSocket.eventRouter_ = null;

/**
 * A TCP/IP based socket backed by a Stream. Used to connect to a relay server.
 */
export class RelaySocket extends StreamSocket {
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
    this.debug(`connect(${address}, ${port})`);

    if (this.address !== null) {
      return WASI.errno.EISCONN;
    }

    this.callback_ = await this.open_(address, port);

    if (!this.callback_) {
      console.error('Unable to connect to relay server.');
      return WASI.errno.EIO;
    }

    this.callback_.onDataAvailable = (data) => this.onRecv(data);
    this.callback_.onClose = () => {
      this.callback_ = null;
      this.close();
    };
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
    if (!this.callback_) {
      return WASI.errno.ECONNRESET;
    }
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

  /** @override */
  async getSocketOption(level, name) {
    switch (level) {
      case SOL_SOCKET: {
        switch (name) {
          case SO_ERROR: {
            // TODO(vapier): This should return current connection state.
            return {option: 0};
          }

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

  /** @override */
  async setSocketOption(level, name, value) {
    switch (level) {
      case SOL_SOCKET: {
        switch (name) {
          case SO_KEEPALIVE: {
            this.tcpKeepAlive_ = value;
            return WASI.errno.ESUCCESS;
          }

          case SO_REUSEADDR: {
            console.warn(`Ignoring SO_REUSEADDR=${value}`);
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

      case IPPROTO_IPV6: {
        switch (name) {
          case IPV6_TCLASS: {
            console.warn(`Ignoring IPV6_TCLASS=${value}`);
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
 * A TCP/IP based socket backed by the Direct Sockets API.
 *
 * @see https://wicg.github.io/direct-sockets/
 */
 export class WebTcpSocket extends StreamSocket {
  /** @override */
  constructor(domain, type, protocol) {
    super(domain, type, protocol);

    this.socket_ = null;
    this.directSocketsReader_ = null;
    this.directSocketsWriter_ = null;

    this.tcpKeepAlive_ = false;
    this.tcpNoDelay_ = false;
  }

  /**
   * @param {!TCPSocket} socket
   * @return {!Promise<!WASI_t.errno>}
   */
  async setTcpSocket_(socket) {
    this.socket_ = socket;
    try {
      const {readable, writable, remoteAddress, remotePort} =
          await this.socket_.opened;
      this.directSocketsReader_ = readable.getReader();
      this.directSocketsWriter_ = writable.getWriter();
      this.address = remoteAddress;
      this.port = remotePort;
    } catch (e) {
      this.socket_ = null;
      console.warn('setTcpSocket_ failed.', e);
      return WASI.errno.ENETUNREACH;
    }
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  async connect(address, port) {
    this.debug(`connect(${address}, ${port})`);

    if (this.address !== null) {
      return WASI.errno.EISCONN;
    }

    const options = {
      noDelay: this.tcpNoDelay_,
    };
    // Keep alive is disabled by default, so don't specify it if it's disabled.
    if (this.tcpKeepAlive_) {
      options.keepAliveDelay = TCP_KEEPALIVE_INTVL * 1000;
    }

    await this.setTcpSocket_(new TCPSocket(address, port, options));
    this.pollData_();

    return WASI.errno.ESUCCESS;
  }

  /** @override */
  async bind(address, port) {
    const handle = new WebTcpServerSocket(
        this.domain, this.filetype, this.protocol);
    const result = await handle.bind(address, port);
    if (result === WASI.errno.ESUCCESS) {
      return handle;
    }
    return result;
  }

  /**
   * Wait for data from the reader, then notify the socket upon receiving data.
   */
  async pollData_() {
    while (true) {
      const {value, done} = await this.directSocketsReader_.read();
      if (done) {
        break;
      }
      this.onRecv(value);
    }
  }

  /** @override */
  async close() {
    if (this.socket_ === null) {
      return;
    }

    if (this.directSocketsReader_) {
      await this.directSocketsReader_.cancel('closing');
      this.directSocketsReader_.releaseLock();
      this.directSocketsReader_ = null;
    }

    if (this.directSocketsWriter_) {
      await this.directSocketsWriter_.abort('closing');
      this.directSocketsWriter_.releaseLock();
      this.directSocketsWriter_ = null;
    }

    try {
      await this.socket_.close();
    } catch (e) {
      console.warn('Error with closing socket.', e);
    }

    this.socket_ = null;
    this.address = null;
    this.port = null;
  }

  /** @override */
  async write(buf) {
    try {
      await this.directSocketsWriter_.ready;
      await this.directSocketsWriter_.write(buf.buffer);
      return {nwritten: buf.buffer.byteLength};
    } catch (e) {
      console.warn('Chunk error:', e);
      return WASI.errno.EIO;
    }
  }

  /**
   * @return {!Promise<!chrome.socket.SocketInfo>}
   */
  async getSocketInfo() {
    // Return a stub socketInfo.
    if (this.socket_ === null) {
      return /** @type {!chrome.socket.SocketInfo} */ ({
        connected: false,
        socketType: 'tcp',
      });
    }

    const info = await this.socket_.opened;

    return /** @type {!chrome.socket.SocketInfo} **/ ({
      connected: true,
      localAddress: info.localAddress,
      localPort: info.localPort,
      peerAddress: info.remoteAddress,
      peerPort: info.remotePort,
      socketType: 'tcp',
    });
  }

  /** @override */
  async getSocketOption(level, name) {
    switch (level) {
      case SOL_SOCKET: {
        switch (name) {
          case SO_ERROR: {
            // TODO(vapier): This should return current connection state.
            return {option: 0};
          }

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

  /** @override */
  async setSocketOption(level, name, value) {
    switch (level) {
      case SOL_SOCKET: {
        switch (name) {
          case SO_KEEPALIVE: {
            this.tcpKeepAlive_ = value;
            return WASI.errno.ESUCCESS;
          }

          case SO_REUSEADDR: {
            console.warn(`Ignoring SO_REUSEADDR=${value}`);
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

      case IPPROTO_IPV6: {
        switch (name) {
          case IPV6_TCLASS: {
            console.warn(`Ignoring IPV6_TCLASS=${value}`);
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

  /** @override */
  static isSupported() {
    return window?.TCPSocket !== undefined;
  }
}

/**
 * A TCP/IP based server socket backed by the Direct Sockets API.
 */
export class WebTcpServerSocket extends StreamSocket {
  /** @override */
  constructor(domain, type, protocol) {
    super(domain, type, protocol);

    this.socket_ = null;

    this.incomingConnectionReader_ = null;

    this.clients_ = [];
    this.callback_ = null;
  }

  /** @override */
  async bind(address, port) {
    this.address = address;
    this.port = port;
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  async listen(backlog) {
    if (this.address == null || this.port == null) {
      return WASI.errno.EINVAL;
    }
    this.socket_ = new TCPServerSocket(
        this.address, {localPort : this.port, backlog});
    try {
      const {readable, localAddress, localPort} = await this.socket_.opened;
      // Update the local address/port with the actual address/port from
      // TCPServerSocketOpenInfo.
      this.address = localAddress;
      this.port = localPort;
      this.incomingConnectionReader_ = readable.getReader();
      this.pollConnection_();
      return WASI.errno.ESUCCESS;
    } catch (e) {
      this.socket_ = null;
      console.warn('listen failed. ', e);
      return WASI.errno.EADDRINUSE;
    }
  }

  /**
   * Polls incoming connection.
   * Adds created connection to clients_.
   */
  async pollConnection_() {
    while (true) {
      const {value:acceptedSocket, done} =
          await this.incomingConnectionReader_.read();
      if (done) {
        break;
      }
      if (acceptedSocket !== undefined) {
        const socket = new WebTcpSocket(
            this.domain, this.filetype, this.protocol);
        await socket.setTcpSocket_(acceptedSocket);
        socket.pollData_();
        this.clients_.push(socket);
        if (this.callback_) {
          this.callback_();
        }
        if (this.receiveListener_) {
          this.receiveListener_();
        }
      }
    }
  }

  /** @override */
  async accept() {
    const result = this.clients_.shift();
    if (result !== undefined) {
      return result;
    }

    return new Promise((resolve) => {
      this.callback_ = () => {
        resolve(this.clients_.shift());
        this.callback_ = null;
      };
    });
  }

  /**
   * @return {!Promise<!chrome.socket.SocketInfo>}
   */
  async getSocketInfo() {
    // Return a stub socketInfo.
    if (this.socket_ === null) {
      return /** @type {!chrome.socket.SocketInfo} */ ({
        connected: false,
        socketType: 'tcp',
      });
    }

    const info = await this.socket_.opened;
    return /** @type {!chrome.socket.SocketInfo} **/ ({
      connected: true,
      localAddress: info.localAddress,
      localPort: info.localPort,
      socketType: 'tcp',
    });
  }

  /** @override */
  async close() {
    if (this.socket_ === null) {
      return;
    }

    if (this.incomingConnectionReader_) {
      await this.incomingConnectionReader_.cancel('closing');
      this.incomingConnectionReader_.releaseLock();
      this.incomingConnectionReader_ = null;
    }

    try {
      await this.socket_.close();
    } catch (e) {
      console.warn('Error with closing socket.', e);
    }

    this.socket_ = null;
    this.address = null;
    this.port = null;
  }
}

/**
 * A local/UNIX socket.
 */
export class UnixSocket extends StreamSocket {
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
    this.debug(`connect(${address}, ${port})`);

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
class ChromeSocketsEventRouter {
  constructor() {
    this.socketMap_ = new Map();
  }

  /**
   * Registers the given socket with the router.
   *
   * Sockets must be registered in order to be notified when they receive
   * data.
   *
   * @param {number} socketId
   * @param {!Object} socket
   */
  register(socketId, socket) {
    this.socketMap_.set(socketId, socket);
  }

  /**
   * Unregisters the socket with the given ID from the router.
   *
   * @param {number} socketId
   */
  unregister(socketId) {
    this.socketMap_.delete(socketId);
  }
}

/**
 * Maps socketIds to sockets and forwards data received to the sockets.
 */
class ChromeTcpSocketEventRouter extends ChromeSocketsEventRouter {
  constructor() {
    super();

    chrome.sockets.tcp.onReceive.addListener(this.onSocketRecv_.bind(this));
  }

  /**
   * The onReceive listener for the chrome.sockets API which forwards data to
   * the associated socket.
   *
   * @param {{socketId: number, data: !ArrayBuffer}} options
   */
  onSocketRecv_({socketId, data}) {
    const handle = this.socketMap_.get(socketId);
    if (handle === undefined) {
      // We don't do anything about this because Chrome broadcasts events to all
      // instances of Secure Shell.  The sockets are not bound to the specific
      // runtime.
      // console.warn(`Data received for unknown socket ${socketId}`);
      // chrome.sockets.tcp.close(socketId);
      return;
    }

    handle.onRecv(data);
  }
}

/**
 * Maps socketIds to sockets and forwards data received to the sockets.
 */
class ChromeTcpListenSocketEventRouter extends ChromeSocketsEventRouter {
  constructor() {
    super();

    chrome.sockets.tcpServer.onAccept.addListener(
        this.onSocketAccept_.bind(this));
  }

  /**
   * The onReceive listener for the chrome.sockets API which forwards data to
   * the associated ChromeTcpListenSocket.
   *
   * @param {!chrome.sockets.tcpServer.AcceptEventData} options
   */
  onSocketAccept_({socketId, clientSocketId}) {
    const handle = this.socketMap_.get(socketId);
    if (handle === undefined) {
      // We don't do anything about this because Chrome broadcasts events to all
      // instances of Secure Shell.  The sockets are not bound to the specific
      // runtime.
      // console.warn(`Connection received for unknown socket ${socketId}`);
      // chrome.sockets.tcpServer.close(socketId);
      return;
    }

    handle.onAccept(clientSocketId);
  }
}

/**
 * Maps socketIds to sockets and forwards data received to the sockets.
 */
class ChromeUdpSocketEventRouter extends ChromeSocketsEventRouter {
  constructor() {
    super();

    chrome.sockets.udp.onReceive.addListener(this.onSocketRecv_.bind(this));
  }

  /**
   * The onReceive listener for the chrome.sockets API which forwards data to
   * the associated ChromeUdpSocket.
   *
   * @param {{socketId: number, data: !ArrayBuffer}} options
   */
  onSocketRecv_({socketId, data}) {
    const handle = this.socketMap_.get(socketId);
    if (handle === undefined) {
      // We don't do anything about this because Chrome broadcasts events to all
      // instances of Secure Shell.  The sockets are not bound to the specific
      // runtime.
      // console.warn(`Data received for unknown socket ${socketId}`);
      // chrome.sockets.udp.close(socketId);
      return;
    }

    handle.onRecv(data);
  }
}
