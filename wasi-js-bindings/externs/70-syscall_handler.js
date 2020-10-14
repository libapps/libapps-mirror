// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Extern settings for syscall handlers.
 */

/**
 * @unrestricted https://github.com/google/closure-compiler/issues/1737
 */
class SyscallHandler {
  /** @param {!Process} process */
  setProcess(process) {}

  /** @return {!WASI_t.errno|{argv: !Array<string|!ArrayBufferView>}} */
  handle_args_get() {}

  /** @return {!WASI_t.errno|{argc: !WASI_t.size, argv_size: !WASI_t.size}} */
  handle_args_sizes_get() {}

  /**
   * @param {!WASI_t.clockid} clockid
   * @return {!WASI_t.errno|{res: (number|bigint)}}
   */
  handle_clock_res_get(clockid) {}

  /**
   * @param {!WASI_t.clockid} clockid
   * @return {!WASI_t.errno|{now: (number|bigint)}}
   */
  handle_clock_time_get(clockid) {}

  /** @return {!WASI_t.errno|{env: !Array<string|!ArrayBufferView>}} */
  handle_environ_get() {}

  /** @return {!WASI_t.errno|{length: !WASI_t.size, size: !WASI_t.size}} */
  handle_environ_sizes_get() {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.filesize} offset
   * @param {!WASI_t.filesize} len
   * @param {!WASI_t.advice} advice
   * @return {!WASI_t.errno}
   */
  handle_fd_advise(fd, offset, len, advice) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.filesize} offset
   * @param {!WASI_t.filesize} len
   * @return {!WASI_t.errno}
   */
  handle_fd_allocate(fd, offset, len) {}

  /**
   * @param {!WASI_t.fd} fd
   * @return {!WASI_t.errno}
   */
  handle_fd_close(fd) {}

  /**
   * @param {!WASI_t.fd} fd
   * @return {!WASI_t.errno}
   */
  handle_fd_datasync(fd) {}

  /**
   * @param {!WASI_t.fd} fd
   * @return {!WASI_t.errno|!WASI_t.fdstat}
   */
  handle_fd_fdstat_get(fd) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.fdflags} fdflags
   * @return {!WASI_t.errno}
   */
  handle_fd_fdstat_set_flags(fd, fdflags) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.rights} fs_rights_base
   * @param {!WASI_t.rights} fs_rights_inheriting
   * @return {!WASI_t.errno}
   */
  handle_fd_fdstat_set_rights(fd, fs_rights_base, fs_rights_inheriting) {}

  /**
   * @param {!WASI_t.fd} fd
   * @return {!WASI_t.errno|!WASI_t.filestat}
   */
  handle_fd_filestat_get(fd) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.filesize} size
   * @return {!WASI_t.errno}
   */
  handle_fd_filestat_set_size(fd, size) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.timestamp} atim
   * @param {!WASI_t.timestamp} mtim
   * @param {!WASI_t.fstflags} fst_flags
   * @return {!WASI_t.errno}
   */
  handle_fd_filestat_set_times(fd, atim, mtim, fst_flags) {}

  /** @return {!WASI_t.errno} */
  handle_fd_pread(fd, offset) {}

  /**
   * @param {!WASI_t.fd} fd
   * @return {!WASI_t.errno|{path: string}}
   */
  handle_fd_prestat_dir_name(fd) {}

  /**
   * @param {!WASI_t.fd} fd
   * @return {!WASI_t.errno|{path: string}}
   */
  handle_fd_prestat_get(fd) {}

  /** @return {!WASI_t.errno} */
  handle_fd_pwrite(fd, offset, buf) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.iovec} iovec
   * @return {!WASI_t.errno|{nread: !WASI_t.size}}
   */
  handle_fd_read(fd, iovec) {}

  /** @return {!WASI_t.errno|{length: !WASI_t.size}} */
  handle_fd_readdir(fd, buf, cookie) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.fd} to
   * @return {!WASI_t.errno}
   */
  handle_fd_renumber(fd, to) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.filedelta} offset
   * @param {!WASI_t.whence} whence
   * @return {!WASI_t.errno|{newoffset: !WASI_t.filesize}}
   */
  handle_fd_seek(fd, offset, whence) {}

  /**
   * @param {!WASI_t.fd} fd
   * @return {!WASI_t.errno}
   */
  handle_fd_sync(fd) {}

  /**
   * @param {!WASI_t.fd} fd
   * @return {!WASI_t.errno|{offset: !WASI_t.filesize}}
   */
  handle_fd_tell(fd) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!ArrayBufferView} buf
   * @return {!WASI_t.errno}
   */
  handle_fd_write(fd, buf) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {?string} path
   * @return {!WASI_t.errno}
   */
  handle_path_create_directory(fd, path) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.lookupflags} lookupflags
   * @param {?string} path
   * @return {!WASI_t.errno|!WASI_t.filestat}
   */
  handle_path_filestat_get(fd, lookupflags, path) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.lookupflags} flags
   * @param {?string} path
   * @param {!WASI_t.timestamp} atim
   * @param {!WASI_t.timestamp} mtim
   * @param {!WASI_t.fstflags} fst_flags
   * @return {!WASI_t.errno}
   */
  handle_path_filestat_set_times(fd, flags, path, atim, mtim, fst_flags) {}

  /**
   * @param {!WASI_t.fd} old_fd
   * @param {!WASI_t.lookupflags} old_flags
   * @param {?string} old_path
   * @param {!WASI_t.fd} new_fd
   * @param {?string} new_path
   * @return {!WASI_t.errno}
   */
  handle_path_link(old_fd, old_flags, old_path, new_fd, new_path) {}

  /**
   * @param {!WASI_t.fd} dirfd
   * @param {!WASI_t.lookupflags} dirflags
   * @param {?string} path
   * @param {!WASI_t.oflags} o_flags
   * @param {!WASI_t.rights} fs_rights_base
   * @param {!WASI_t.rights} fs_rights_inheriting
   * @param {!WASI_t.fdflags} fdflags
   * @return {!WASI_t.errno|{fd: !WASI_t.fd}}
   */
  handle_path_open(dirfd, dirflags, path, o_flags, fs_rights_base,
                   fs_rights_inheriting, fdflags) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {?string} path
   * @param {!Uint8Array} buf
   * @return {!WASI_t.errno|{length: !WASI_t.size}}
   */
  handle_path_readlink(fd, path, buf) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {?string} path
   * @return {!WASI_t.errno}
   */
  handle_path_remove_directory(fd, path) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {?string} old_path
   * @param {!WASI_t.fd} new_fd
   * @param {?string} new_path
   * @return {!WASI_t.errno}
   */
  /** @return {!WASI_t.errno} */
  handle_path_rename(fd, old_path, new_fd, new_path) {}

  /**
   * @param {?string} old_path
   * @param {!WASI_t.fd} fd
   * @param {?string} new_path
   * @return {!WASI_t.errno}
   */
  handle_path_symlink(old_path, fd, new_path) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {?string} path
   * @return {!WASI_t.errno}
   */
  handle_path_unlink_file(fd, path) {}

  /**
   * @param {!Array<!WASI_t.subscription>} subscriptions
   * @return {!WASI_t.errno|{events: !Array<!WASI_t.event>}}
   */
  handle_poll_oneoff(subscriptions) {}

  /**
   * @param {!WASI_t.exitcode} status
   * @return {!WASI_t.errno}
   */
  handle_proc_exit(status) {}

  /**
   * @param {!WASI_t.signal} signal
   * @return {!WASI_t.errno}
   */
  handle_proc_raise(signal) {}

  /**
   * @param {!ArrayBufferView|!SharedArrayBuffer} buf
   * @return {!WASI_t.errno}
   */
  handle_random_get(buf) {}

  /** @return {!WASI_t.errno} */
  handle_sched_yield() {}

  /** @return {!WASI_t.errno} */
  handle_sock_recv(fd, ri_data, ri_flags, ro_datalen_ptr, ro_flags_ptr) {}

  /** @return {!WASI_t.errno} */
  handle_sock_send(fd, si_data, si_flags, so_datalen_ptr) {}

  /** @return {!WASI_t.errno} */
  handle_sock_shutdown(fd, how) {}
}
