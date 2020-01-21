// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Extern settings for syscall entry's.
 */

/** @extends {SyscallHandler} */
class SyscallEntry {
  /** @param {!Process} process */
  setProcess(process) {}

  /**
   * Get list of all registered syscall imports.
   *
   * @return {!Object<string, !Array<string>>}
   */
  getImports() {}

  /**
   * @param {!WASI_t.pointer} argv
   * @param {!WASI_t.pointer} argv_buf
   * @return {!WASI_t.errno}
   */
  sys_args_get(argv, argv_buf) {}

  /**
   * @param {!WASI_t.pointer} argc
   * @param {!WASI_t.pointer} argv_size
   * @return {!WASI_t.errno}
   */
  sys_args_sizes_get(argc, argv_size) {}

  /**
   * @param {!WASI_t.clockid} clockid
   * @param {!WASI_t.pointer} resolution_ptr
   * @return {!WASI_t.errno}
   */
  sys_clock_res_get(clockid, resolution_ptr) {}

  /**
   * @param {!WASI_t.clockid} clockid
   * @param {!WASI_t.timestamp} precision
   * @param {!WASI_t.pointer} time_ptr
   * @return {!WASI_t.errno}
   */
  sys_clock_time_get(clockid, precision, time_ptr) {}

  /**
   * @param {!WASI_t.pointer} envp
   * @param {!WASI_t.pointer} env_buf
   * @return {!WASI_t.errno}
   */
  sys_environ_get(envp, env_buf) {}

  /**
   * @param {!WASI_t.pointer} env_size
   * @param {!WASI_t.pointer} env_buf
   * @return {!WASI_t.errno}
   */
  sys_environ_sizes_get(env_size, env_buf) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.filesize} offset
   * @param {!WASI_t.filesize} len
   * @param {!WASI_t.advice} advice
   * @return {!WASI_t.errno}
   */
  sys_fd_advise(fd, offset, len, advice) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.filesize} offset
   * @param {!WASI_t.filesize} len
   * @return {!WASI_t.errno}
   */
  sys_fd_allocate(fd, offset, len) {}

  /**
   * @param {!WASI_t.fd} fd
   * @return {!WASI_t.errno}
   */
  sys_fd_close(fd) {}

  /**
   * @param {!WASI_t.fd} fd
   * @return {!WASI_t.errno}
   */
  sys_fd_datasync(fd) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.pointer} buf
   * @return {!WASI_t.errno}
   */
  sys_fd_fdstat_get(fd, buf) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.fdflags} fdflags
   * @return {!WASI_t.errno}
   */
  sys_fd_fdstat_set_flags(fd, fdflags) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.rights} fs_rights_base
   * @param {!WASI_t.rights} fs_rights_inheriting
   * @return {!WASI_t.errno}
   */
  sys_fd_fdstat_set_rights(fd, fs_rights_base, fs_rights_inheriting) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.pointer} filestat_ptr
   * @return {!WASI_t.errno}
   */
  sys_fd_filestat_get(fd, filestat_ptr) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.filesize} size
   * @return {!WASI_t.errno}
   */
  sys_fd_filestat_set_size(fd, size) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.timestamp} atim
   * @param {!WASI_t.timestamp} mtim
   * @param {!WASI_t.fstflags} fst_flags
   * @return {!WASI_t.errno}
   */
  sys_fd_filestat_set_times(fd, atim, mtim, fst_flags) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.pointer} iovs_ptr
   * @param {!WASI_t.size} iovs_len
   * @param {!WASI_t.filesize} offset
   * @param {!WASI_t.pointer} nread_ptr
   * @return {!WASI_t.errno}
   */
  sys_fd_pread(fd, iovs_ptr, iovs_len, offset, nread_ptr) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.pointer} path_ptr
   * @param {!WASI_t.size} path_len
   * @return {!WASI_t.errno}
   */
  sys_fd_prestat_dir_name(fd, path_ptr, path_len) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.pointer} buf
   * @return {!WASI_t.errno}
   */
  sys_fd_prestat_get(fd, buf) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.pointer} iovs_ptr
   * @param {!WASI_t.size} iovs_len
   * @param {!WASI_t.filesize} offset
   * @param {!WASI_t.pointer} nwritten_ptr
   * @return {!WASI_t.errno}
   */
  sys_fd_pwrite(fd, iovs_ptr, iovs_len, offset, nwritten_ptr) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.pointer} iovs_ptr
   * @param {!WASI_t.size} iovs_len
   * @param {!WASI_t.pointer} nread_ptr
   * @return {!WASI_t.errno}
   */
  sys_fd_read(fd, iovs_ptr, iovs_len, nread_ptr) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.pointer} buf_ptr
   * @param {!WASI_t.size} buf_len
   * @param {!WASI_t.dircookie} cookie
   * @param {!WASI_t.pointer} size_ptr
   * @return {!WASI_t.errno}
   */
  sys_fd_readdir(fd, buf_ptr, buf_len, cookie, size_ptr) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.fd} to
   * @return {!WASI_t.errno}
   */
  sys_fd_renumber(fd, to) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.filedelta} offset
   * @param {!WASI_t.whence} whence
   * @param {!WASI_t.pointer} newoffset_ptr
   * @return {!WASI_t.errno}
   */
  sys_fd_seek(fd, offset, whence, newoffset_ptr) {}

  /**
   * @param {!WASI_t.fd} fd
   * @return {!WASI_t.errno}
   */
  sys_fd_sync(fd) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.pointer} offset_ptr
   * @return {!WASI_t.errno}
   */
  sys_fd_tell(fd, offset_ptr) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.pointer} iovs_ptr
   * @param {!WASI_t.size} iovs_len
   * @param {!WASI_t.pointer} nwritten_ptr
   * @return {!WASI_t.errno}
   */
  sys_fd_write(fd, iovs_ptr, iovs_len, nwritten_ptr) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.pointer} path_ptr
   * @param {!WASI_t.size} path_len
   * @return {!WASI_t.errno}
   */
  sys_path_create_directory(fd, path_ptr, path_len) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.lookupflags} lookupflags
   * @param {!WASI_t.pointer} path_ptr
   * @param {!WASI_t.size} path_len
   * @param {!WASI_t.pointer} filestat_ptr
   * @return {!WASI_t.errno}
   */
  sys_path_filestat_get(fd, lookupflags, path_ptr, path_len, filestat_ptr) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.lookupflags} flags
   * @param {!WASI_t.pointer} path_ptr
   * @param {!WASI_t.size} path_len
   * @param {!WASI_t.timestamp} atim
   * @param {!WASI_t.timestamp} mtim
   * @param {!WASI_t.fstflags} fst_flags
   * @return {!WASI_t.errno}
   */
  sys_path_filestat_set_times(fd, flags, path_ptr, path_len, atim, mtim,
                              fst_flags) {}

  /**
   * @param {!WASI_t.fd} old_fd
   * @param {!WASI_t.lookupflags} old_flags
   * @param {!WASI_t.pointer} old_path_ptr
   * @param {!WASI_t.size} old_path_len
   * @param {!WASI_t.fd} new_fd
   * @param {!WASI_t.pointer} new_path_ptr
   * @param {!WASI_t.size} new_path_len
   * @return {!WASI_t.errno}
   */
  sys_path_link(old_fd, old_flags, old_path_ptr, old_path_len, new_fd,
                new_path_ptr, new_path_len) {}

  /**
   * @param {!WASI_t.fd} dirfd
   * @param {!WASI_t.lookupflags} dirflags
   * @param {!WASI_t.pointer} path_ptr
   * @param {!WASI_t.size} path_len
   * @param {!WASI_t.oflags} o_flags
   * @param {!WASI_t.rights} fs_rights_base
   * @param {!WASI_t.rights} fs_rights_inheriting
   * @param {!WASI_t.fdflags} fdflags
   * @param {!WASI_t.pointer} fd_ptr
   * @return {!WASI_t.errno}
   */
  sys_path_open(dirfd, dirflags, path_ptr, path_len, o_flags, fs_rights_base,
                fs_rights_inheriting, fdflags, fd_ptr) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.pointer} path_ptr
   * @param {!WASI_t.size} path_len
   * @param {!WASI_t.pointer} buf_ptr
   * @param {!WASI_t.size} buf_len
   * @param {!WASI_t.pointer} bufused_ptr
   * @return {!WASI_t.errno}
   */
  sys_path_readlink(fd, path_ptr, path_len, buf_ptr, buf_len, bufused_ptr) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.pointer} path_ptr
   * @param {!WASI_t.size} path_len
   * @return {!WASI_t.errno}
   */
  sys_path_remove_directory(fd, path_ptr, path_len) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.pointer} old_path_ptr
   * @param {!WASI_t.size} old_path_len
   * @param {!WASI_t.fd} new_fd
   * @param {!WASI_t.pointer} new_path_ptr
   * @param {!WASI_t.size} new_path_len
   * @return {!WASI_t.errno}
   */
  sys_path_rename(fd, old_path_ptr, old_path_len, new_fd, new_path_ptr,
                  new_path_len) {}

  /**
   * @param {!WASI_t.pointer} old_path_ptr
   * @param {!WASI_t.size} old_path_len
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.pointer} new_path_ptr
   * @param {!WASI_t.size} new_path_len
   * @return {!WASI_t.errno}
   */
  sys_path_symlink(old_path_ptr, old_path_len, fd, new_path_ptr,
                   new_path_len) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.pointer} path_ptr
   * @param {!WASI_t.size} path_len
   * @return {!WASI_t.errno}
   */
  sys_path_unlink_file(fd, path_ptr, path_len) {}

  sys_poll_oneoff(...args) {}

  /**
   * @param {!WASI_t.exitcode} status
   * @return {!WASI_t.errno}
   */
  sys_proc_exit(status) {}

  /**
   * @param {!WASI_t.signal} signal
   * @return {!WASI_t.errno}
   */
  sys_proc_raise(signal) {}

  /**
   * Fill the supplied buffer with random bytes.
   *
   * @param {!WASI_t.pointer} buf Offset of the buffer to fill in WASM memory.
   * @param {!WASI_t.size} buf_len Length of buf in bytes.
   * @return {!WASI_t.errno} The result from the syscall handler.
   */
  sys_random_get(buf, buf_len) {}

  /** @return {!WASI_t.errno} */
  sys_sched_yield() {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.pointer} ri_data_ptr
   * @param {!WASI_t.size} ri_data_len
   * @param {!WASI_t.u16} ri_flags
   * @param {!WASI_t.pointer} ro_datalen_ptr
   * @param {!WASI_t.pointer} ro_flags_ptr
   * @return {!WASI_t.errno}
   */
  sys_sock_recv(fd, ri_data_ptr, ri_data_len, ri_flags, ro_datalen_ptr,
                ro_flags_ptr) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.pointer} si_data_ptr
   * @param {!WASI_t.size} si_data_len
   * @param {!WASI_t.u16} si_flags
   * @param {!WASI_t.pointer} so_datalen_ptr
   * @return {!WASI_t.errno}
   */
  sys_sock_send(fd, si_data_ptr, si_data_len, si_flags, so_datalen_ptr) {}

  /**
   * @param {!WASI_t.fd} fd
   * @param {!WASI_t.u32} how
   * @return {!WASI_t.errno}
   */
  sys_sock_shutdown(fd, how) {}
}
