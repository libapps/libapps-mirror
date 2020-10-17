// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview
 * @suppress {moduleLoad}
 * @suppress {checkTypes} module$__$wasi_js_bindings$js naming confusion.
 */

import * as SyscallEntry from '../../wasi-js-bindings/js/syscall_entry.js';
import * as SyscallHandler from '../../wasi-js-bindings/js/syscall_handler.js';
import * as WASI from '../../wasi-js-bindings/js/wasi.js';
import * as VFS from './vfs.js';

class Tty extends VFS.FileHandle {
  constructor(term) {
    super('/dev/tty', WASI.filetype.CHARACTER_DEVICE);
    this.term = term;
    this.td = new TextDecoder();
  }

  /** @override */
  stat() {
    return {
      fs_filetype: this.filetype,
      fs_rights_base: WASI.rights.FD_READ | WASI.rights.FD_WRITE,
    };
  }

  /** @override */
  write(data) {
    this.term.innerText += this.td.decode(data, {stream: true});
    return {nwritten: data.length};
  }
}

/**
 * Wassh implementation of direct syscalls.
 *
 * These must all be synchronous.
 */
export class DirectWasiPreview1 extends SyscallHandler.DirectWasiPreview1 {
}

/**
 * Wassh implementation of proxied syscalls.
 *
 * These may be asynchronous.
 */
export class RemoteReceiverWasiPreview1 extends SyscallHandler.Base {
  constructor(...args) {
    super(...args);
    this.vfs = new VFS.VFS({stdio: false});
  }

  async init() {
    const tty = new Tty(document.getElementById('terminal'));
    this.vfs.initStdio(tty);

    const root = new VFS.DirectoryHandler('/');
    this.vfs.addHandler(root);
    await this.vfs.open('/');

    const sshdir = new VFS.OriginPrivateDirectoryHandler('/.ssh');
    this.vfs.addHandler(sshdir);

    const cwd = new VFS.CwdHandler('/.ssh');
    this.vfs.addHandler(cwd);
    await this.vfs.open('.');

    this.vfs.addHandler(new VFS.DevNullHandler());
  }

  /** @override */
  handle_fd_close(fd) {
    return this.vfs.close(fd);
  }

  /** @override */
  handle_path_filestat_get(path) {
    const stat = this.vfs.stat(path);
    if (typeof stat === 'number') {
      return stat;
    }

    return /** @type {!WASI_t.filestat} */ ({
      dev: 0n,
      ino: 0n,
      filetype: WASI.filetype.UNKNOWN,
      nlink: 0n,
      size: 0n,
      atim: 0n,
      mtim: 0n,
      ctim: 0n,
      ...stat,
    });
  }

  /** @override */
  handle_fd_filestat_get(fd) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    const stat = this.vfs.stat(fh.path);
    if (typeof stat === 'number') {
      return stat;
    }

    return /** @type {!WASI_t.filestat} */ ({
      dev: 0n,
      ino: 0n,
      filetype: WASI.filetype.UNKNOWN,
      nlink: 0n,
      size: 0n,
      atim: 0n,
      mtim: 0n,
      ctim: 0n,
      ...stat,
    });
  }

  /** @override */
  handle_fd_fdstat_get(fd) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    const stat = fh.stat();
    return /** @type {!WASI_t.fdstat} */ ({
      fs_filetype: WASI.filetype.UNKNOWN,
      fs_flags: 0,
      fs_rights_base: 0xffffffffffffffffn,
      fs_rights_inheriting: 0xffffffffffffffffn,
      ...stat,
    });
  }

  /** @override */
  async handle_fd_pread(fd, length, offset) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    return fh.pread(length, offset);
  }

  /** @override */
  handle_fd_prestat_dir_name(fd) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    // This func only operates on dirs.
    if (fh.filetype !== WASI.filetype.DIRECTORY) {
      return WASI.errno.ENOTDIR;
    }

    return {path: fh.path};
  }

  /** @override */
  handle_fd_prestat_get(fd) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    // This func only operates on dirs.
    if (fh.filetype !== WASI.filetype.DIRECTORY) {
      return WASI.errno.ENOTDIR;
    }

    return {path: fh.path};
  }

  /** @override */
  async handle_fd_pwrite(fd, offset, buf) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    return fh.pwrite(offset, buf);
  }

  /** @override */
  handle_fd_dup(oldfd) {
    return this.vfs.dup(oldfd);
  }

  /** @override */
  handle_fd_dup2(oldfd, newfd) {
    return this.vfs.dup(oldfd, newfd);
  }

  /** @override */
  handle_fd_renumber(fd, to) {
    return this.vfs.dup2(fd, to);
  }

  /** @override */
  async handle_fd_read(fd, length) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    return fh.read(length);
  }

  /** @override */
  handle_fd_seek(fd, offset, whence) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    return fh.seek(offset, whence);
  }

  /** @override */
  handle_fd_tell(fd) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    return fh.tell();
  }

  /** @override */
  async handle_fd_write(fd, buf) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    return fh.write(buf);
  }

  /** @override */
  handle_path_open(dirfd, dirflags, path, o_flags, fs_rights_base,
                   fs_rights_inheriting, fs_flags) {
    return this.vfs.openat(dirfd, dirflags, path, o_flags);
  }
}
