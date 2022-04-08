// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Tests for random APIs.
 */

import {Process, SyscallEntry, SyscallHandler, WASI} from '../index.js';

describe('random.js', () => {

/**
 * A handler just to capture output.
 */
class TestSyscallHandler extends SyscallHandler.DirectWasiPreview1 {
  constructor(...args) {
    super(...args);
    this.stdout = '';
    this.stderr = '';
    this.td = new TextDecoder();
  }

  /** @override */
  handle_fd_write(fd, buf) {
    switch (fd) {
      case 1:
        this.stdout += this.td.decode(buf, {stream: true});
        return WASI.errno.ESUCCESS;

      case 2:
        this.stderr += this.td.decode(buf, {stream: true});
        return WASI.errno.ESUCCESS;
    }

    return WASI.errno.EINVAL;
  }
}

/**
 * Helper function to run the wasm module & return output.
 *
 * @param {!ArrayBuffer} prog The program to run.
 * @param {!Array<string>} argv The program arguments.
 * @return {!Object} The program results.
 */
async function run(prog, argv) {
  const handler = new TestSyscallHandler();
  const sys_handlers = [handler];
  const proc = new Process.Foreground({
    executable: prog,
    argv: ['random.wasm', ...argv],
    sys_handlers: sys_handlers,
    sys_entries: [
      new SyscallEntry.WasiPreview1({sys_handlers}),
    ],
  });
  const ret = await proc.run();
  assert.equal(handler.stderr, '');
  return {
    returncode: ret,
    stdout: handler.stdout,
    stderr: handler.stderr,
    data: /** @type {!Array<number>} */ (JSON.parse(handler.stdout)),
  };
}

/**
 * Load some common state that all tests in here want.
 */
before(async function() {
  /**
   * If running on a web page, SharedArrayBuffers might not work.
   */
  if (window.SharedArrayBuffer === undefined) {
    console.warn('SharedArrayBuffer API not available');
    this.skip();
    return;
  }

  /**
   * Fetch & read the body once to speed up the tests.
   *
   * @type {!ArrayBuffer}
   */
  this.prog = await fetch('random.wasm')
    .then((response) => response.arrayBuffer());
});

/**
 * Make sure the array is full of random values.
 *
 * We check that they aren't all zeros, and at least one value is different from
 * the others.  It's possible for real random values to "violate" those rules,
 * but the chances of that should be extremely low as we sample over 128-bits.
 *
 * @param {!Array<number>} buf The array full of random numbers.
 */
function looksRandom(buf) {
  // Check all values are not zero.
  const sum = buf.reduce((a, b) => a + b);
  assert.notEqual(sum, 0);

  // Check that all values are not duplicates.
  let i;
  for (i = 0; i < buf.length; ++i) {
    const matches = buf.filter((ele) => ele === buf[i]);
    if (matches.length === 1) {
      break;
    }
  }
  assert.notEqual(i, buf.length);
}

/**
 * Verify arc4random() is random.  Most of the implementation is in the WASI
 * C library code we didn't author, but it builds on top of our syscalls.
 */
it('arc4random', async function() {
  const result = await run(this.prog, ['arc4random']);
  looksRandom(result.data);
});

/**
 * Verify arc4random_buf() is random.  Most of the implementation is in the WASI
 * C library code we didn't author, but it builds on top of our syscalls.
 */
it('arc4random_buf', async function() {
  const result = await run(this.prog, ['arc4random_buf']);
  looksRandom(result.data);
});

/**
 * Verify getentropy() is random.  Most of the implementation is in the WASI
 * C library code we didn't author, but it builds on top of our syscalls.
 */
it('getentropy', async function() {
  const result = await run(this.prog, ['getentropy']);
  looksRandom(result.data);
});

});
