// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Tests for SyscallLock.
 */

import {SyscallLock} from '../js/syscall_lock.js';

describe('syscall_lock.js', () => {

/**
 * Check BigInt is correctly serialized and deserialized.
 */
it('setData and getData BigInt', () => {
  const buf = new SharedArrayBuffer(64 * 1024);
  const lock = new SyscallLock(buf);
  const data = {events: [{fd_read: {nwritten: BigInt(100)}}]};
  lock.setData(data);
  const deserialized = lock.getData();
  assert.deepStrictEqual(deserialized, data);
});

/**
 * Check TypedArray is correctly serialized and deserialized as an Array.
 */
it('setData and getData TypedArray', () => {
  const typedArray = new Uint8Array([1, 2, 3, 4, 5]);
  const buf = new SharedArrayBuffer(64 * 1024);
  const lock = new SyscallLock(buf);
  const data = {foo: [{bar: typedArray}]};
  const expected = {foo: [{bar: Array.from(typedArray)}]};
  lock.setData(data);
  const deserialized = lock.getData();
  assert.deepStrictEqual(deserialized, expected);
});

});
