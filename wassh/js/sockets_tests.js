// Copyright 2026 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test suite for sockets code.
 * @suppress {moduleLoad}
 * @suppress {checkTypes} module$__$wasi_js_bindings$js naming confusion.
 */

import {WASI} from '../../wasi-js-bindings/index.js';
import * as Constants from './constants.js';
import * as Sockets from './sockets.js';
import {RemoteReceiverWasiPreview1} from './syscall_handler.js';

/**
 * Fake socket for testing handle_sock_connect.
 */
class FakeSocket extends Sockets.Socket {
  /**
   * @param {string} address
   * @param {number} port
   * @return {!Promise<!WASI_t.errno>}
   * @override
   */
  async connect(address, port) {
    this.address = address;
    this.port = port;
    return WASI.errno.ESUCCESS;
  }
}

/**
 * Fake socket whose connect always fails.
 */
class RefusingSocket extends FakeSocket {
  /**
   * @param {string} address
   * @param {number} port
   * @return {!Promise<!WASI_t.errno>}
   * @override
   */
  async connect(address, port) {
    return WASI.errno.ECONNREFUSED;
  }
}

/**
 * Check IPv4 parsing.
 */
describe('strAddrToArray-ipv4', () => {
  [
    ['0.0.0.0', [0, 0, 0, 0]],
    ['255.255.255.255', [255, 255, 255, 255]],
    ['127.0.0.1', [127, 0, 0, 1]],
  ].forEach(([ip, exp]) => {
    it(ip, () => {
      const arr = Sockets.strAddrToArray(ip);
      assert.deepStrictEqual(arr, exp);
    });
  });
});

/**
 * Check IPv6 parsing.
 */
describe('strAddrToArray-ipv6', () => {
  [
    ['::', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    ['::1', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]],
    ['1::', [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    ['fe80::3eff:fe63:3550',
     [0xfe, 0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0x3e, 0xff, 0xfe, 0x63, 0x35, 0x50]],
  ].forEach(([ip, exp]) => {
    it(ip, () => {
      const arr = Sockets.strAddrToArray(ip);
      assert.deepStrictEqual(arr, exp);
    });
  });
});

/**
 * Verify the onConnectAttempt hook in handle_sock_connect.
 */
describe('handle_sock_connect-onConnectAttempt', () => {
  it('resolves fakeAddrMap hostname and ignores subsequent connects',
     async () => {
    const attempts = [];
    const handler = new RemoteReceiverWasiPreview1({
      onConnectAttempt: (address, port) => attempts.push([address, port]),
    });
    handler.handle_sock_register_fake_addr(0, 'resolved.c.googlers.com');

    const unixSock = new FakeSocket(
        Constants.AF_UNIX, Constants.SOCK_STREAM, 0);
    const unixFd = handler.vfs.openHandle(unixSock);
    await handler.handle_sock_connect(unixFd, '/AF_UNIX/agent/gnubby', 0);
    assert.deepStrictEqual(attempts, []);

    const tcpSock1 = new FakeSocket(
        Constants.AF_INET, Constants.SOCK_STREAM, -1);
    const tcpFd1 = handler.vfs.openHandle(tcpSock1);
    await handler.handle_sock_connect(tcpFd1, 0, 22);
    assert.deepStrictEqual(attempts, [['resolved.c.googlers.com', 22]]);

    const tcpSock2 = new FakeSocket(
        Constants.AF_INET, Constants.SOCK_STREAM, 0);
    const tcpFd2 = handler.vfs.openHandle(tcpSock2);
    await handler.handle_sock_connect(tcpFd2, '10.0.0.1', 2222);
    assert.deepStrictEqual(attempts, [['resolved.c.googlers.com', 22]]);
  });

  it('reports direct IP address when protocol is not -1', async () => {
    const attempts = [];
    const handler = new RemoteReceiverWasiPreview1({
      onConnectAttempt: (address, port) => attempts.push([address, port]),
    });
    const tcpSock = new FakeSocket(
        Constants.AF_INET, Constants.SOCK_STREAM, 0);
    const tcpFd = handler.vfs.openHandle(tcpSock);
    await handler.handle_sock_connect(tcpFd, '192.168.1.50', 22);
    assert.deepStrictEqual(attempts, [['192.168.1.50', 22]]);
  });

  it('fires even when the connect fails', async () => {
    const attempts = [];
    const handler = new RemoteReceiverWasiPreview1({
      onConnectAttempt: (address, port) => attempts.push([address, port]),
    });
    const tcpSock = new RefusingSocket(
        Constants.AF_INET6, Constants.SOCK_STREAM, 0);
    const tcpFd = handler.vfs.openHandle(tcpSock);
    const ret = await handler.handle_sock_connect(tcpFd, '::1', 22);
    assert.equal(ret, WASI.errno.ECONNREFUSED);
    assert.deepStrictEqual(attempts, [['::1', 22]]);
  });

  it('is optional', async () => {
    const handler = new RemoteReceiverWasiPreview1({});
    const tcpSock = new FakeSocket(
        Constants.AF_INET, Constants.SOCK_STREAM, 0);
    const tcpFd = handler.vfs.openHandle(tcpSock);
    const ret = await handler.handle_sock_connect(tcpFd, '192.168.1.50', 22);
    assert.equal(ret, WASI.errno.ESUCCESS);
  });

  it('cannot break the connect if it throws', async () => {
    let calls = 0;
    const handler = new RemoteReceiverWasiPreview1({
      onConnectAttempt: () => {
        ++calls;
        throw new Error('boom');
      },
    });
    const tcpSock = new FakeSocket(
        Constants.AF_INET, Constants.SOCK_STREAM, 0);
    const tcpFd = handler.vfs.openHandle(tcpSock);
    const ret = await handler.handle_sock_connect(tcpFd, '192.168.1.50', 22);
    assert.equal(ret, WASI.errno.ESUCCESS);
    assert.equal(tcpSock.address, '192.168.1.50');

    const tcpSock2 = new FakeSocket(
        Constants.AF_INET, Constants.SOCK_STREAM, 0);
    const tcpFd2 = handler.vfs.openHandle(tcpSock2);
    await handler.handle_sock_connect(tcpFd2, '10.0.0.1', 22);
    assert.equal(calls, 1);
  });
});
