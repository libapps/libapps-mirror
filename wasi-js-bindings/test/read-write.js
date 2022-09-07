// Copyright 2021 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Tests for read & write functions.
 */

import * as Process from '../js/process.js';
import * as SyscallEntry from '../js/syscall_entry.js';
import * as SyscallHandler from '../js/syscall_handler.js';
import * as util from '../js/util.js';
import * as WASI from '../js/wasi.js';

describe('read-write.js', () => {

class FileHandle {
  constructor() {
    this.buf = new Uint8Array(0);
    // NB: This is not how a standard file handle behaves -- it only has one
    // file offset pointer, and it moves based on reads & writes.  We maintain
    // separate ones here purely for ease of testing: it allows us to write to
    // a fd then quickly read the data back out.  To support a single offset,
    // we'd have to implement & include lseek usage in our testing.
    this.write_pos = 0;
    this.read_pos = 0;
  }

  write(buf) {
    const ret = this.pwrite(buf, this.write_pos);
    this.write_pos += ret;
    return ret;
  }

  pwrite(buf, offset) {
    offset = Number(offset);
    if (this.buf.length < offset + buf.length) {
      const newbuf = new Uint8Array(offset + buf.length);
      newbuf.set(this.buf);
      this.buf = newbuf;
    }
    this.buf.set(buf, offset);
    return buf.length;
  }

  read(length) {
    const buf = this.pread(length, this.read_pos);
    this.read_pos += buf.length;
    return buf;
  }

  pread(length, offset) {
    const off = Number(offset);
    const buf = this.buf.slice(off, off + length);
    return buf;
  }
}

/**
 * A handler just to capture output.
 */
class TestSyscallHandler extends SyscallHandler.DirectWasiPreview1 {
  constructor(...args) {
    super(...args);
    this.stdout = '';
    this.stderr = '';
    this.td = new TextDecoder();
    this.fd = {};
  }

  /** @override */
  handle_fd_write(fd, buf) {
    if (fd < 0) {
      return WASI.errno.EBADF;
    }

    switch (fd) {
      case 0:
        return WASI.errno.EINVAL;

      case 1:
        this.stdout += this.td.decode(buf, {stream: true});
        return WASI.errno.ESUCCESS;

      case 2:
        this.stderr += this.td.decode(buf, {stream: true});
        return WASI.errno.ESUCCESS;

      default: {
        let fh = this.fd[fd];
        if (fh === undefined) {
          fh = this.fd[fd] = new FileHandle();
        }
        fh.write(buf);
        return WASI.errno.ESUCCESS;
      }
    }
  }

  /** @override */
  handle_fd_pwrite(fd, buf, offset) {
    if (fd < 0) {
      return WASI.errno.EBADF;
    }

    switch (fd) {
      case 0:
      case 1:
      case 2:
        return WASI.errno.EINVAL;

      default: {
        let fh = this.fd[fd];
        if (fh === undefined) {
          fh = this.fd[fd] = new FileHandle();
        }
        fh.pwrite(buf, offset);
        return WASI.errno.ESUCCESS;
      }
    }
  }

  /** @override */
  handle_fd_read(fd, length) {
    if (fd < 0) {
      return WASI.errno.EBADF;
    }

    switch (fd) {
      case 0:
        return WASI.errno.EAGAIN;

      case 1:
      case 2:
        return WASI.errno.EINVAL;

      default: {
        const fh = this.fd[fd];
        if (fh === undefined) {
          return WASI.errno.EBADF;
        }
        const buf = fh.read(length);
        return {
          buf: buf,
          nread: buf.length,
        };
      }
    }
  }

  /** @override */
  handle_fd_pread(fd, length, offset) {
    if (fd < 0) {
      return WASI.errno.EBADF;
    }

    switch (fd) {
      case 0:
        return WASI.errno.EAGAIN;

      case 1:
      case 2:
        return WASI.errno.EINVAL;

      default: {
        const fh = this.fd[fd];
        if (fh === undefined) {
          return WASI.errno.EBADF;
        }
        const buf = fh.pread(length, offset);
        return {
          buf: buf,
          nread: buf.length,
        };
      }
    }
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
    argv: ['read-write.wasm', ...argv],
    sys_handlers: sys_handlers,
    sys_entries: [
      new SyscallEntry.WasiPreview1({sys_handlers}),
    ],
  });
  let ret;
  try {
    ret = await proc.run();
  } catch (e) {
    assert.fail(`${handler.stdout}\n${handler.stderr}\n${e}`);
  }
  return {
    returncode: ret,
    stdout: handler.stdout,
    stderr: handler.stderr,
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
  this.prog = await fetch('read-write.wasm')
    .then((response) => response.arrayBuffer());
});

/**
 * Check internal assert handling.
 */
it('asserts', async function() {
  await run(this.prog, [
    'clear-errno',
    'ret', '0',
    'errno', '0',
    'string', '',
    'lstring', '1', '',
  ]);
});

/**
 * Verify read() works.
 */
it('read', async function() {
  await run(this.prog, [
    // Read an invalid fd.
    'clear-errno',
    'read', '123', '1',
    'ret', '-1',
    'errno', `${WASI.errno.EBADF}`,

    // Write to an fd and then read the data back out.
    'clear-errno',
    'write', '3', 'abcde',
    'read', '3', '5',
    'ret', '5',
    'errno', '0',
    'string', 'abcde',
  ]);
});

/**
 * Verify readv() works.
 */
it('readv', async function() {
  await run(this.prog, [
    // Read an invalid fd.
    'clear-errno',
    'readv', '123', '1', '1',
    'ret', '-1',
    'errno', `${WASI.errno.EBADF}`,

    // Write to an fd and then read the data back out.
    'clear-errno',
    'write', '3', 'abcde',
    'readv', '3', '4', '2', '0', '2', '1',
    'ret', '5',
    'errno', '0',
    'string', 'abcde',
  ]);
});

/**
 * Verify pread() works.
 */
it('pread', async function() {
  await run(this.prog, [
    // Read an invalid fd.
    'clear-errno',
    'pread', '123', '1', '1',
    'ret', '-1',
    'errno', `${WASI.errno.EBADF}`,

    // Write to an fd and then read the data back out.
    'clear-errno',
    'write', '3', 'abcde',
    'pread', '3', '2', '2',
    'ret', '2',
    'errno', '0',
    'string', 'cd',
    'pread', '3', '3', '1',
    'ret', '3',
    'errno', '0',
    'string', 'bcd',
  ]);
});

/**
 * Verify preadv() works.
 */
it('preadv', async function() {
  await run(this.prog, [
    // Read an invalid fd.
    'clear-errno',
    'preadv', '123', '1', '1', '1',
    'ret', '-1',
    'errno', `${WASI.errno.EBADF}`,

    // Write to an fd and then read the data back out.
    'clear-errno',
    'write', '3', 'abcde',
    'preadv', '3', '2', '2', '1', '2',
    'ret', '3',
    'errno', '0',
    'string', 'cde',
  ]);
});

/**
 * Verify write() works.
 */
it('write', async function() {
  await run(this.prog, [
    // Write an invalid fd.
    'clear-errno',
    'write', '-123', 'str',
    'ret', '-1',
    'errno', `${WASI.errno.EBADF}`,

    // Write to an fd and then read the data back out.
    'clear-errno',
    'write', '3', 'abcde',
    'ret', '5',
    'errno', '0',
    'read', '3', '5',
    'string', 'abcde',
  ]);
});

/**
 * Verify writev() works.
 */
it('writev', async function() {
  await run(this.prog, [
    // Write an invalid fd.
    'clear-errno',
    'writev', '-123', '1', 'str',
    'ret', '-1',
    'errno', `${WASI.errno.EBADF}`,

    // Write to an fd and then read the data back out.
    'clear-errno',
    'writev', '3', '3', 'a', 'bcd', 'e',
    'ret', '5',
    'errno', '0',
    'read', '3', '5',
    'string', 'abcde',
  ]);
});

/**
 * Verify pwrite() works.
 */
it('pwrite', async function() {
  await run(this.prog, [
    // Write an invalid fd.
    'clear-errno',
    'pwrite', '-123', 'str', '1',
    'ret', '-1',
    'errno', `${WASI.errno.EBADF}`,

    // Write to an fd and then read the data back out.
    'clear-errno',
    'pwrite', '3', 'Xb', '0',
    'ret', '2',
    'errno', '0',
    'pread', '3', '5', '0',
    'string', 'Xb',
    'write', '3', 'a',
    'ret', '1',
    'errno', '0',
    'pread', '3', '5', '0',
    'string', 'ab',
    'pwrite', '3', 'cde', '2',
    'ret', '3',
    'errno', '0',
    'pread', '3', '5', '0',
    'string', 'abcde',
  ]);
});

/**
 * Verify pwritev() works.
 */
it('pwritev', async function() {
  await run(this.prog, [
    // Write an invalid fd.
    'clear-errno',
    'pwritev', '-123', '1', '1', 'str',
    'ret', '-1',
    'errno', `${WASI.errno.EBADF}`,

    // Write to an fd and then read the data back out.
    'clear-errno',
    'pwritev', '3', '0', '2', 'Xe', 'abcde',
    'ret', '7',
    'errno', '0',
    'pread', '3', '5', '0',
    'string', 'Xeabc',
  ]);
});

});
