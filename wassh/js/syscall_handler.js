// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview
 * @suppress {moduleLoad}
 */

import * as SyscallEntry from '../../wasi-js-bindings/js/syscall_entry.js';
import * as SyscallHandler from '../../wasi-js-bindings/js/syscall_handler.js';
import * as WASI from '../../wasi-js-bindings/js/wasi.js';

class File {
  constructor(path) {
    this.path = path;
    this.open = true;
  }

  close() {
    this.open = false;
  }
}

/**
 */
class FdMap extends Map {
  constructor() {
    super([
      [0, new File('/dev/stdin')],
      [1, new File('/dev/stdout')],
      [2, new File('/dev/stderr')],
      // WASI requires the pre-opened paths start at 3.
      [3, new File('/')],
      [4, new File('/dev/')],
      [5, new File('./')],
    ]);
    this.next_ = 50;
  }

  next() {
    return this.next_++;
  }
}

/**
 * Wassh implementation of direct syscalls.
 *
 * These must all be synchronous.
 */
export class DirectWasiUnstable extends SyscallHandler.DirectWasiUnstable {
}

/**
 * Wassh implementation of proxied syscalls.
 *
 * These may be asynchronous.
 */
export class RemoteReceiverWasiUnstable extends SyscallHandler.Base {
  constructor(...args) {
    super(...args);
    this.term = document.getElementById('terminal');
    this.td = new TextDecoder();
    this.fds = new FdMap();
  }

  handle_fd_close(fd) {
    const file = this.fds.get(fd);
    if (file === undefined || !file.open) {
      return WASI.errno.EBADF;
    }

    file.close();
    return WASI.errno.ESUCCESS;
  }

  handle_fd_fdstat_get(fd) {
    const file = this.fds.get(fd);
    if (file === undefined || !file.open) {
      return WASI.errno.EBADF;
    }

    // This func only operates on dirs.
    const path = file.path;
    if (!path.endsWith('/')) {
      return WASI.errno.ENOTDIR;
    }

    return /** @type {!WASI_t.fdstat} */ ({
      fs_filetype: WASI.filetype.DIRECTORY,
      fs_flags: 0,
      fs_rights_base: BigInt(0xffffffffff),
      fs_rights_inheriting: BigInt(0xffffffffff),
    });
  }

  handle_fd_prestat_dir_name(fd) {
    const file = this.fds.get(fd);
    if (file === undefined || !file.open) {
      return WASI.errno.EBADF;
    }

    // This func only operates on dirs.
    const path = file.path;
    if (!path.endsWith('/')) {
      return WASI.errno.ENOTDIR;
    }

    return {path};
  }

  handle_fd_prestat_get(fd) {
    const file = this.fds.get(fd);
    if (file === undefined || !file.open) {
      return WASI.errno.EBADF;
    }

    // This func only operates on dirs.
    const path = file.path;
    if (!path.endsWith('/')) {
      return WASI.errno.ENOTDIR;
    }

    return {path};
  }

  handle_fd_pwrite(fd, offset, buf) {
    this.term.innerText += this.td.decode(buf, {stream: true});
    return WASI.errno.ESUCCESS;
  }

  handle_fd_write(fd, buf) {
    if (fd < 3) {
      this.term.innerText += this.td.decode(buf, {stream: true});
    }
    return WASI.errno.ESUCCESS;
  }

  handle_path_open(dirfd, dirflags, path, o_flags, fs_rights_base,
                   fs_rights_inheriting, fs_flags) {
    const dir = this.fds.get(dirfd);
    if (dir === undefined || !dir.open) {
      return WASI.errno.EBADF;
    }

    const dirpath = dir.path;
    if (!dirpath.endsWith('/')) {
      return WASI.errno.ENOTDIR;
    }
    this.debug(`  dirpath = "${dirpath}"`);

    const fd = this.fds.next();
    this.fds.set(fd, new File(dirpath + path));
    this.debug(`  -> fd=${fd} path="${dirpath + path}"`);
    return {fd};
  }
}
