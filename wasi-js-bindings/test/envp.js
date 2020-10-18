// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Tests for initial environment passing.
 */

import {Process, SyscallEntry, SyscallHandler, WASI} from '../index.js';

describe('envp.js', () => {

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
 *   envc: number,
 *   environ: !Array<?string>,
 *   mem: !Object,
 * }}
 */
const TestData = {};

/**
 * Helper function to run the wasm module & return output.
 *
 * @param {!ArrayBuffer} prog The program to run.
 * @param {!Object<string, string>=} environ The program environment.
 * @return {!Object} The program results.
 */
async function run(prog, environ) {
  const handler = new TestSyscallHandler();
  const sys_handlers = [handler];
  const proc = new Process.Foreground({
    executable: prog,
    argv: ['envp.wasm'],
    environ: environ,
    sys_handlers: sys_handlers,
    sys_entries: [
      new SyscallEntry.WasiPreview1({sys_handlers}),
    ],
  });
  const status = await proc.run();
  assert.equal(handler.stderr, '');
  return {
    returncode: status,
    stdout: handler.stdout,
    stderr: handler.stderr,
    data: /** @type {!TestData} */ (JSON.parse(handler.stdout)),
  };
}

/**
 * Load some common state that all tests in here want.
 */
before(async function() {
  // Fetch & read the body once to speed up the tests.
  this.prog = await fetch('envp.wasm')
    .then((response) => response.arrayBuffer());
});

/**
 * Check default Program environ behavior.
 */
it('no env', async function() {
  const result = await run(this.prog);
  const data = result.data;
  assert.equal(data.envc, 1);
  assert.deepEqual(data.environ, [null]);
});

/**
 * Check empty environ={} behavior.
 */
it('empty', async function() {
  const result = await run(this.prog, {});
  const data = result.data;
  assert.equal(data.envc, 1);
  assert.deepEqual(data.environ, [null]);
});

/**
 * Check a single env var set.
 */
it('one var', async function() {
  const result = await run(this.prog, {'foo': 'bar'});
  const data = result.data;
  assert.equal(data.envc, 2);
  assert.deepEqual(data.environ, ['foo=bar', null]);
});

/**
 * Check a multiple env vars set.
 */
it('couple vars', async function() {
  const result = await run(this.prog, {'foo': 'bar', 'fox': 'cat'});
  const data = result.data;
  assert.equal(data.envc, 3);
  assert.deepEqual(data.environ, ['foo=bar', 'fox=cat', null]);
});

/**
 * Check vars with whitespace.
 */
it('whitespace vars', async function() {
  const result = await run(this.prog, {
    'spa ce': 'sp ace',
    'ta\tb': 't\tab',
    'new\nline': 'newline\n',
  });
  const data = result.data;
  assert.equal(data.envc, 4);
  assert.deepEqual(data.environ, [
    'spa ce=sp ace',
    'ta\tb=t\tab',
    'new\nline=newline\n',
    null,
  ]);
});

/**
 * Check UTF-8 encoded env vars.
 */
it('utf8 vars', async function() {
  const result = await run(this.prog, {'das': 'heiß', 'mögen': 'tests'});
  const data = result.data;
  assert.equal(data.envc, 3);
  assert.deepEqual(data.environ, ['das=heiß', 'mögen=tests', null]);
});

});
