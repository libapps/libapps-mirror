// Copyright 2026 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Sockets from './sockets.js';

/**
 * @fileoverview Test suite for sockets code.
 */

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
