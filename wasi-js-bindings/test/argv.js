// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Tests for initial argument passing.
 */

import * as Process from '../js/process.js';
import * as SyscallEntry from '../js/syscall_entry.js';
import * as SyscallHandler from '../js/syscall_handler.js';
import * as util from '../js/util.js';
import * as WASI from '../js/wasi.js';

describe('argv.js', () => {

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
 *   argc: number,
 *   argv: !Array<string>,
 *   mem: !Object,
 * }}
 */
const TestData = {};

/**
 * Helper function to run the wasm module & return output.
 *
 * @param {!ArrayBuffer} prog The program to run.
 * @param {!Array<string>=} argv The program arguments.
 * @return {!Object} The program results.
 */
async function run(prog, argv) {
  const handler = new TestSyscallHandler();
  const sys_handlers = [handler];
  const proc = new Process.Foreground({
    executable: prog,
    argv: argv,
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
  this.prog = await fetch('argv.wasm')
    .then((response) => response.arrayBuffer());
});

/**
 * Check default Program argv behavior.
 */
it('no args', async function() {
  const result = await run(this.prog);
  const data = result.data;
  assert.equal(data.argc, 1);
  assert.deepEqual(data.argv, ['wasi-program']);
});

/**
 * Check argv=[] behavior.
 */
it('empty args', async function() {
  const result = await run(this.prog, []);
  const data = result.data;
  assert.equal(data.argc, 0);
  assert.deepEqual(data.argv, []);
});

/**
 * Check argv=[prog] behavior.
 */
it('argv0 only', async function() {
  const result = await run(this.prog, ['my-prog']);
  const data = result.data;
  assert.equal(data.argc, 1);
  assert.deepEqual(data.argv, ['my-prog']);
});

/**
 * Check multiple arguments behavior.
 */
it('couple args', async function() {
  const result = await run(this.prog, ['my-prog', 'foo', 'bar']);
  const data = result.data;
  assert.equal(data.argc, 3);
  assert.deepEqual(data.argv, ['my-prog', 'foo', 'bar']);
});

/**
 * Check arguments with whitespace behavior.
 */
it('whitespace args', async function() {
  const result = await run(this.prog, ['p', 'spa ce', 'ta\tb', 'new\nline']);
  const data = result.data;
  assert.equal(data.argc, 4);
  assert.deepEqual(data.argv, ['p', 'spa ce', 'ta\tb', 'new\nline']);
});

/**
 * Check UTF-8 encoded arguments behavior.
 */
it('utf8 args', async function() {
  const result = await run(this.prog, ['my-prog', 'das', 'ist', 'heiß']);
  const data = result.data;
  assert.equal(data.argc, 4);
  assert.deepEqual(data.argv, ['my-prog', 'das', 'ist', 'heiß']);
});

/**
 * Verify we abort early with non-array argv's.
 */
it('not array', async function() {
  try {
    /** @suppress {checkTypes} We call run() incorrectly on purpose. */
    const run_ = async () => { await run(this.prog, {}); };
    await run_();
  } catch (e) {
    // assert.throws doesn't work with promises.
    assert.instanceOf(e, util.ApiViolation);
  }
});

/**
 * Verify we abort early with non-string args.
 */
it('not string', async function() {
  try {
    await run(this.prog, ['ok', 123]);
  } catch (e) {
    // assert.throws doesn't work with promises.
    assert.instanceOf(e, util.ApiViolation);
  }
});

});
