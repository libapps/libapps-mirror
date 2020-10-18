// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Tests for structures shared between JS & WASM worlds.
 */

import {Process, SyscallEntry, SyscallHandler, WASI,
        WasiView} from '../index.js';

describe('structs.js', () => {

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
 * @return {!Object} The program results.
 */
async function run() {
  const handler = new TestSyscallHandler();
  const sys_handlers = [handler];
  const prog = 'structs.wasm';
  const proc = new Process.Foreground({
    executable: prog,
    sys_handlers: sys_handlers,
    sys_entries: [
      new SyscallEntry.WasiPreview1({sys_handlers}),
    ],
  });
  const ret = await proc.run();
  return {
    returncode: ret,
    stdout: handler.stdout,
    stderr: handler.stderr,
  };
}

/** @type {?Object} */
let structCache;

/**
 * Return structure details from the WASM side of things.
 *
 * @param {string} name The structure to look up.
 * @return {!Object} The structure details.
 */
async function getWasiStruct(name) {
  if (!structCache) {
    const result = await run();
    structCache = /** @type {!Object} */ (JSON.parse(result.stdout));
  }

  return structCache[name];
}

/**
 * Run tests against the specified structure.
 *
 * This will verify all the fields match: existence, size, and offset.
 *
 * @param {string} structName The structure to check.
 */
function checkStruct(structName) {
  const size = (type) => {
    if (type === 'EventFdReadWrite') {
      return WasiView.event_fd_readwrite_t.struct_size;
    } else if (WasiView.typedefs.Uint8.indexOf(type) !== -1) {
      return 1;
    } else if (WasiView.typedefs.Uint16.indexOf(type) !== -1) {
      return 2;
    } else if (WasiView.typedefs.Uint32.indexOf(type) !== -1) {
      return 4;
    } else if (WasiView.typedefs.BigUint64.indexOf(type) !== -1) {
      return 8;
    } else {
      return parseInt(type.match(/[0-9]+$/)[0], 10) / 8;
    }
  };
  const jsStruct = WasiView[structName];

  describe(structName, () => {
    it('common', async () => {
      const wasiStruct = await getWasiStruct(structName);
      assert.equal(wasiStruct.struct_size, jsStruct.struct_size);
    });
    for (const [name, field] of Object.entries(jsStruct.fields)) {
      it(name, async () => {
        const wasiStruct = await getWasiStruct(structName);
        const wasiField = wasiStruct.fields[name];
        assert.equal(field.offset, wasiField.offset);
        assert.equal(size(field.type), wasiField.size);
      });
    }
  });
}

checkStruct('ciovec_t');
checkStruct('dirent_t');
checkStruct('event_t');
checkStruct('event_fd_readwrite_t');
checkStruct('fdstat_t');
checkStruct('filestat_t');
checkStruct('iovec_t');
checkStruct('subscription_clock_t');
checkStruct('subscription_fd_readwrite_t');

});
