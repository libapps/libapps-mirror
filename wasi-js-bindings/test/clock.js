// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Tests for clock APIs.
 */

import * as Process from '../js/process.js';
import * as SyscallEntry from '../js/syscall_entry.js';
import * as SyscallHandler from '../js/syscall_handler.js';
import * as WASI from '../js/wasi.js';

describe('clock.js', () => {

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
 * The format the WASM program outputs.
 *
 * @typedef {{
 *   getres: !Array<string>,
 *   gettime: !Array<!Array<string>>,
 * }}
 */
const TestData = {};

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
    argv: ['clock.wasm', ...argv],
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
    data: /** @type {!TestData} */ (JSON.parse(handler.stdout)),
  };
}

/**
 * Load some common state that all tests in here want.
 */
before(async function() {
  /**
   * Fetch & read the body once to speed up the tests.
   *
   * @type {!ArrayBuffer}
   */
  this.prog = await fetch('clock.wasm')
    .then((response) => response.arrayBuffer());
});

/**
 * Combine timespec fields into a single value.
 *
 * @param {string} seconds The tv_sec[onds] field.
 * @param {string} nanoseconds The tv_n[ano]sec[onds] field.
 * @return {bigint} The time in nanoseconds.
 */
function getNanosec(seconds, nanoseconds) {
  return BigInt(seconds) * 1000000000n + BigInt(nanoseconds);
}

/**
 * Verify monotonic clock behavior.
 */
it('monotonic', async function() {
  const result = await run(this.prog, ['monotonic']);
  const data = result.data;

  // Check resolution.
  assert.deepEqual(data.getres, ['0', '1']);

  // Check it is indeed monotonic.
  let curr = -1n;
  for (let i = 0; i < data.gettime.length; ++i) {
    const next = getNanosec(...data.gettime[i]);
    // assert.isBelow doesn't support BigInt yet.
    assert(curr < next, `${curr} < ${next}`);
    curr = next;
  }
});

/**
 * Verify realtime clock behavior.
 */
it('realtime', async function() {
  const result = await run(this.prog, ['realtime']);
  const data = result.data;

  // Check resolution.
  assert.deepEqual(data.getres, ['0', '1000000']);

  // Check it is indeed monotonic.
  let curr = -1n;
  for (let i = 0; i < data.gettime.length; ++i) {
    const next = getNanosec(...data.gettime[i]);
    // assert.isBelow doesn't support BigInt yet.
    assert(curr < next, `${curr} < ${next}`);
    curr = next;
  }
});

});
