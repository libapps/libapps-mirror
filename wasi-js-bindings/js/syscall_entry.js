// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Syscall entry APIs.  Programs call these directly, and they
 * rely on syscall handlers to implement the actual syscall.
 */

import * as util from './util.js';
import * as WASI from './wasi.js';

/**
 * Shim for combining two 32-bit ints into a BigInt.
 *
 * This works around limitations in WASM<->JS; hopefully this will be fixed:
 * https://github.com/WebAssembly/JS-BigInt-integration
 *
 * @param {number} lo The lower 32-bit half.
 * @param {number} hi The higher 32-bit half.
 * @return {BigInt} The combined 64-bit number.
 */
function makeBigInt(lo, hi) {
  return BigInt(lo) | (BigInt(hi) << BigInt(32));
}

/**
 * Base class for creating syscall entries.
 */
export class Base {
  constructor({sys_handlers, process, trace}) {
    this.enableTrace_ = trace;
    this.process_ = null;
    this.bindHandlers_(sys_handlers);
  }

  setProcess(process) {
    this.process_ = process;
  }

  getMem_(...args) {
    return this.process_.getMem(...args);
  }

  getView_(...args) {
    return this.process_.getView(...args);
  }

  /**
   * Log a debug message.
   */
  debug(...args) {
    this.process_.debug(...args);
  }

  /**
   * Log an error message.
   */
  logError(...args) {
    this.process_.logError(...args);
  }

  traceCall(func, prefix, ...args) {
    this.debug(`${prefix}(${args.join(', ')})`);
    const ret = func(...args);
    if (Number.isInteger(ret)) {
      this.debug(`  ${prefix} -> ${util.strerror(ret)}`);
    } else {
      this.debug(`  ${prefix} ->`, ret);
    }
    return ret;
  }

  createTracer_(func, prefix) {
    if (this.enableTrace_) {
      return this.traceCall.bind(this, func, prefix);
    } else {
      return func;
    }
  }

  /**
   * A stub func that always returns ENOSYS.
   *
   * @return {number} ENOSYS.
   */
  enosysStub_() {
    return WASI.errno.ENOSYS;
  }

  unhandledExceptionWrapper_(func, ...args) {
    try {
      return func(...args);
    } catch (e) {
      if (e instanceof util.CompletedProcessError) {
        return e;
      }
      this.logError(e);
      return WASI.errno.ENOTRECOVERABLE;
    }
  }

  /**
   * Bind handlers to this object.
   *
   * This will populate this instance with "handle_xxx" methods for each
   * syscall.  If the |handlers| provide a relevant implementation, we'll use
   * it, otherwise we'll fallback to a stub that returns ENOSYS.
   *
   * @param handlers {Array<!Object>} Array of SyscallHandler objects.
   */
  bindHandlers_(handlers = []) {
    if (!Array.isArray(handlers)) {
      handlers = [handlers];
    }

    this.getSyscalls_().forEach((key) => {
      const method = `handle_${key.slice(4)}`;
      let i;
      for (i = 0; i < handlers.length; ++i) {
        const handler = handlers[i];
        if (method in handler) {
          this[method] = this.createTracer_(
              handler[method].bind(handler), `handler: ${method}`);
          break;
        }
      }
      if (i == handlers.length) {
        this[method] = this.createTracer_(
            this.enosysStub_, `handler: enosysStub_: ${method}`);
      }
    });
  }

  /**
   * Get list of all registered syscall entries.
   */
  getSyscalls_() {
    return Array.from(util.getAllPropertyNames(this))
      .filter((key) => key.startsWith('sys_'));
  }

  getImports() {
    const entries = {};
    this.getSyscalls_().forEach((key) => {
      entries[key.slice(4)] = this.createTracer_(
          this.unhandledExceptionWrapper_.bind(this, this[key].bind(this)),
          `entry: ${key}`);
    });
    return {[this.namespace]: entries};
  }
}

/**
 * WASI syscall entries.
 */
export class WasiUnstable extends Base {
  constructor(...args) {
    super(...args);
    this.namespace = 'wasi_unstable';
  }

  get_nullable_path_(ptr, len) {
    let ret = null;
    if (ptr) {
      const td = new TextDecoder();
      const buf = this.getMem_(ptr, ptr + len);
      try {
        ret = td.decode(buf);
      } catch {
        return WASI.errno.EFAULT;
      }
    }
    return ret;
  }

  sys_args_get(argv, argv_buf) {
    const ret = this.handle_args_get();
    if (Number.isInteger(ret)) {
      return ret;
    }

    const te = new TextEncoder();
    const dvArgv = this.getView_(argv, 4 * ret.argv.length);
    let ptr = argv_buf;
    for (let i = 0; i < ret.argv.length; ++i) {
      const buf = this.getMem_(ptr);
      dvArgv.setUint32(i * 4, ptr, true);
      let length;
      const arg = ret.argv[i];
      if (typeof arg === 'string') {
        length = te.encodeInto(arg, buf).written;
      } else {
        buf.set(arg);
        length = arg.length;
      }
      buf[length] = 0;
      ptr += length + 1;
    }
    return WASI.errno.ESUCCESS;
  }

  sys_args_sizes_get(argc, argv_size) {
    const ret = this.handle_args_sizes_get();
    if (Number.isInteger(ret)) {
      return ret;
    }

    const dvSize = this.getView_(argc, 4);
    const dvBuf = this.getView_(argv_size, 4);
    dvSize.setUint32(0, ret.argc, true);
    dvBuf.setUint32(0, ret.argv_size, true);
    return WASI.errno.ESUCCESS;
  }

  sys_clock_res_get(clockid, resolution_ptr) {
    const ret = this.handle_clock_res_get(clockid);
    if (Number.isInteger(ret)) {
      return ret;
    }

    const dv = this.getView_(resolution_ptr, 8);
    dv.setBigUint64(0, ret.res, true);
    return WASI.errno.ESUCCESS;
  }

  sys_clock_time_get(clockid, precisionLo, precisionHi, time_ptr) {
    // TODO: Figure out what to do with precision.
    const precision = makeBigInt(precisionLo, precisionHi);
    const ret = this.handle_clock_time_get(clockid);
    if (Number.isInteger(ret)) {
      return ret;
    }

    const dv = this.getView_(time_ptr, 8);
    dv.setBigUint64(0, ret.now, true);
    return WASI.errno.ESUCCESS;
  }

  sys_environ_get(envp, env_buf) {
    const ret = this.handle_environ_get();
    if (Number.isInteger(ret)) {
      return ret;
    }

    const te = new TextEncoder();
    const env = ret.env;
    const dvEnvp = this.getView_(envp, 4 * (env.length + 1));
    let ptr = env_buf;
    for (let i = 0; i < env.length; ++i) {
      const buf = this.getMem_(ptr);
      dvEnvp.setUint32(i * 4, ptr, true);
      let length;
      const arg = env[i];
      if (typeof arg === 'string') {
        length = te.encodeInto(arg, buf).written;
      } else {
        buf.set(arg);
        length = arg.length;
      }
      buf[length] = 0;
      ptr += length + 1;
    }
    // The NULL terminator.
    dvEnvp.setUint32(4 * env.length, 0, true);
    return WASI.errno.ESUCCESS;
  }

  sys_environ_sizes_get(env_size, env_buf) {
    const ret = this.handle_environ_sizes_get();
    if (Number.isInteger(ret)) {
      return ret;
    }

    const dvSize = this.getView_(env_size, 4);
    const dvBuf = this.getView_(env_buf, 4);
    // Include one extra for NULL terminator.
    // XXX: Is this necessary ?
    dvSize.setUint32(0, ret.length + 1, true);
    dvBuf.setUint32(0, ret.size, true);
    return WASI.errno.ESUCCESS;
  }

  sys_fd_advise(fd, offsetLo, offsetHi, lenLo, lenHi, advice) {
    const offset = makeBigInt(offsetLo, offsetHi);
    const len = makeBigInt(lenLo, lenHi);
    return this.handle_fd_advise(fd, offset, len, advice);
  }

  sys_fd_allocate(fd, offsetLo, offsetHi, lenLo, lenHi) {
    const offset = makeBigInt(offsetLo, offsetHi);
    const len = makeBigInt(lenLo, lenHi);
    return this.handle_fd_allocate(fd, offset, len);
  }

  sys_fd_close(fd) {
    return this.handle_fd_close(fd);
  }

  sys_fd_datasync(fd) {
    return this.handle_fd_datasync(fd);
  }

  sys_fd_fdstat_get(fd, buf) {
    const ret = this.handle_fd_fdstat_get(fd);
    if (Number.isInteger(ret)) {
      return ret;
    }

    const dv = this.getView_(buf);
    dv.setFdstat(0, ret, true);
    return WASI.errno.ESUCCESS;
  }

  sys_fd_fdstat_set_flags(fd, fdflags) {
    return this.handle_fd_fdstat_set_flags(fd, fdflags);
  }

  sys_fd_fdstat_set_rights(fd, fs_rights_baseLo, fs_rights_baseHi,
                           fs_rights_inheritingLo, fs_rights_inheritingHi) {
    const fs_rights_base = makeBigInt(fs_rights_baseLo, fs_rights_baseHi);
    const fs_rights_inheriting = makeBigInt(fs_rights_inheritingLo,
                                          fs_rights_inheritingHi);
    return this.handle_fd_fdstat_set_rights(
        fd, fs_rights_base, fs_rights_inheriting);
  }

  sys_fd_filestat_get(fd, filestat_ptr) {
    const ret = this.handle_fd_filestat_get(fd);
    if (Number.isInteger(ret)) {
      return ret;
    }

    const dv = this.getView_(filestat_ptr);
    dv.setFilestat(0, ret, true);
    return WASI.errno.ESUCCESS;
  }

  sys_fd_filestat_set_size(fd, sizeLo, sizeHi) {
    const size = makeBigInt(sizeLo, sizeHi);
    return this.handle_fd_filestat_set_size(fd, size);
  }

  sys_fd_filestat_set_times(fd, atimLo, atimHi, mtimLo, mtimHi, fst_flags) {
    const atim = makeBigInt(atimLo, atimHi);
    const mtim = makeBigInt(mtimLo, mtimHi);
    return this.handle_fd_filestat_set_times(fd, atim, mtim, fst_flags);
  }

  sys_fd_pread(fd, iovs_ptr, iovs_len, offsetLo, offsetHi, nread_ptr) {
    const offset = makeBigInt(offsetLo, offsetHi);
    return WASI.errno.ENOSYS;
  }

  sys_fd_prestat_dir_name(fd, path_ptr, path_len) {
    const ret = this.handle_fd_prestat_get(fd);
    if (Number.isInteger(ret)) {
      return ret;
    }

    const buf = this.getMem_(path_ptr, path_ptr + path_len);
    const te = new TextEncoder();
    te.encodeInto(ret.path, buf);
    return WASI.errno.ESUCCESS;
  }

  sys_fd_prestat_get(fd, buf) {
    const ret = this.handle_fd_prestat_get(fd);
    if (Number.isInteger(ret)) {
      return ret;
    }

    const dv = this.getView_(buf, 8);
    dv.setUint8(0, 0 /*__WASI_PREOPENTYPE_DIR*/, true);

    const te = new TextEncoder();
    dv.setUint32(4, te.encode(ret.path).length, true);
    return WASI.errno.ESUCCESS;
  }

  sys_fd_pwrite(fd, iovs_ptr, iovs_len, offsetLo, offsetHi, nwritten_ptr) {
    const offset = makeBigInt(offsetLo, offsetHi);
    let nwritten = 0;
    for (let i = 0; i < iovs_len; ++i) {
      const dv = this.getView_(iovs + (8 * i), 8);
      const bufptr = dv.getUint32(0, true);
      const buflen = dv.getUint32(4, true);
      if (buflen == 0) {
        continue;
      }
      const buf = this.getMem_(bufptr, bufptr + buflen);
      const ret = this.handle_fd_pwrite(fd, offset, buf);
      if (ret != WASI.errno.ESUCCESS) {
        return ret;
      }
      nwritten += buflen;
    }
    const dvWritten = this.getView_(nwritten_ptr, 4);
    dvWritten.setUint32(0, nwritten, true);
    return WASI.errno.ESUCCESS;
  }

  sys_fd_read(fd, iovs_ptr, iovs_len, nread_ptr) {
    const dvIovs = this.getView_(iovs_ptr);
    const dvNread = this.getView_(nread_ptr, 4);
    let nread = 0;
    dvNread.setUint32(0, nread, true);
    let offset = 0;
    for (let i = 0; i < iovs_len; ++i) {
      const iovec = dvIovs.getIovec(offset);
      const ret = this.handle_fd_read(fd, iovec);
      if (Number.isInteger(ret) && ret != WASI.errno.ESUCCESS) {
        return ret;
      }

      nread += ret.nread;
      dvNread.setUint32(0, nread, true);
      offset += iovec.length;
    }
    return WASI.errno.ESUCCESS;
  }

  sys_fd_readdir(fd, buf_ptr, buf_len, cookieLo, cookieHi, size_ptr) {
    const cookie = makeBigInt(cookieLo, cookieHi);
    const buf = this.getMem_(buf_ptr, buf_ptr + buf_len);
    const ret = this.handle_fd_readdir(fd, buf, cookie);
    if (Number.isInteger(ret)) {
      return ret;
    }

    const dv = this.getView_(size_ptr);
    dv.setUint32(0, ret.length, true);
    return WASI.errno.ESUCCESS;
  }

  sys_fd_renumber(fd, to) {
    return this.handle_fd_renumber(fd, to);
  }

  sys_fd_seek(fd, offset, whence, newoffset_ptr) {
    const ret = this.handle_fd_seek(fd, offset, whence);
    if (Number.isInteger(ret)) {
      return ret;
    }

    const dv = this.getView_(newoffset_ptr, 8);
    dv.setBigUint64(0, ret.newoffset, true);
    return WASI.errno.ESUCCESS;
  }

  sys_fd_sync(fd) {
    return this.handle_fd_sync(fd);
  }

  sys_fd_tell(fd, filesize_ptr) {
    const ret = this.handle_fd_sync(fd);
    if (Number.isInteger(ret)) {
      return ret;
    }

    const dv = this.getView_(filesize_ptr, 8);
    dv.setBigUint64(0, ret.filesize, true);
    return WASI.errno.ESUCCESS;
  }

  sys_fd_write(fd, iovs, iovs_len, nwritten_ptr) {
    // const fn = fd == 1 ? console.error : console.info;
    let nwritten = 0;
    for (let i = 0; i < iovs_len; ++i) {
      const dv = this.getView_(iovs + (8 * i), 8);
      const bufptr = dv.getUint32(0, true);
      const buflen = dv.getUint32(4, true);
      if (buflen == 0) {
        continue;
      }
      const buf = this.getMem_(bufptr, bufptr + buflen);
      const ret = this.handle_fd_write(fd, buf);
      if (ret != WASI.errno.ESUCCESS) {
        return ret;
      }
      nwritten += buflen;
    }
    const dvWritten = this.getView_(nwritten_ptr, 4);
    dvWritten.setUint32(0, nwritten, true);
    return WASI.errno.ESUCCESS;
  }

  sys_path_create_directory(fd, path_ptr, path_len) {
    const path = this.get_nullable_path_(path_ptr, path_len);
    if (Number.isInteger(path)) {
      return path;
    }

    return this.handle_path_create_directory(fd, path);
  }

  sys_path_filestat_get(fd, lookupflags, path_ptr, path_len, filestat_ptr) {
    const path = this.get_nullable_path_(path_ptr, path_len);
    if (Number.isInteger(path)) {
      return path;
    }

    const ret = this.handle_path_filestat_get(fd, lookupflags, path);
    if (Number.isInteger(ret)) {
      return ret;
    }

    const dv = this.getView_(filestat_ptr);
    dv.setFilestat(0, ret, true);
    return WASI.errno.ESUCCESS;
  }

  sys_path_filestat_set_times(fd, flags, path_ptr, path_len, atimLo, atimHi,
                              mtimLo, mtimHi, fst_flags) {
    const path = this.get_nullable_path_(path_ptr, path_len);
    if (Number.isInteger(path)) {
      return path;
    }

    const atim = makeBigInt(atimLo, atimHi);
    const mtim = makeBigInt(mtimLo, mtimHi);
    return this.handle_path_filestat_set_times(fd, flags, path, atim, mtim, fst_flags);
  }

  sys_path_link(old_fd, old_flags, old_path_ptr, old_path_len, new_fd,
                new_path_ptr, new_path_len) {
    const old_path = this.get_nullable_path_(old_path_ptr, old_path_len);
    if (Number.isInteger(old_path)) {
      return old_path;
    }

    const new_path = this.get_nullable_path_(new_path_ptr, new_path_len);
    if (Number.isInteger(new_path)) {
      return new_path;
    }

    return this.handle_path_link(old_fd, old_flags, old_path, new_fd, new_path);
  }

  sys_path_open(dirfd, dirflags, path_ptr, path_len, o_flags,
                fs_rights_baseLo, fs_rights_baseHi,
                fs_rights_inheritingLo, fs_rights_inheritingHi,
                fs_flags, fdptr) {
    const path = this.get_nullable_path_(path_ptr, path_len);
    if (Number.isInteger(path)) {
      return path;
    }
    this.debug(`  path = "${path}"`);

    const ret = this.handle_path_open(
        dirfd, dirflags, path, o_flags,
        makeBigInt(fs_rights_baseLo, fs_rights_baseHi),
        makeBigInt(fs_rights_inheritingLo, fs_rights_inheritingHi),
        fs_flags);
    if (Number.isInteger(ret)) {
      return ret;
    }

    const dv = this.getView_(fdptr, 4);
    dv.setUint32(0, ret.fd, true);
    return WASI.errno.ESUCCESS;
  }

  sys_path_readlink(fd, path_ptr, path_len, buf_ptr, buf_len, bufused_ptr) {
    const path = this.get_nullable_path_(path_ptr, path_len);
    if (Number.isInteger(path)) {
      return path;
    }

    const buf = this.getMem_(buf_ptr, buf_ptr + buf_len);
    const ret = this.handle_path_readlink(fd, path, buf);
    if (Number.isInteger(ret)) {
      return ret;
    }

    const dv = this.getView_(bufused_ptr);
    dv.setUint32(0, ret.length, true);
    return WASI.errno.ESUCCESS;
  }

  sys_path_remove_directory(fd, path_ptr, path_len) {
    const path = this.get_nullable_path_(path_ptr, path_len);
    if (Number.isInteger(path)) {
      return path;
    }

    return this.handle_path_remove_directory(fd, path);
  }

  sys_path_rename(fd, old_path_ptr, old_path_len, new_fd, new_path_ptr,
                  new_path_len) {
    const old_path = this.get_nullable_path_(old_path_ptr, old_path_len);
    if (Number.isInteger(old_path)) {
      return old_path;
    }

    const new_path = this.get_nullable_path_(new_path_ptr, new_path_len);
    if (Number.isInteger(new_path)) {
      return new_path;
    }

    return this.handle_path_rename(fd, old_path, new_fd, new_path);
  }

  sys_path_symlink(old_path_ptr, old_path_len, fd, new_path_ptr, new_path_len) {
    const old_path = this.get_nullable_path_(old_path_ptr, old_path_len);
    if (Number.isInteger(old_path)) {
      return old_path;
    }

    const new_path = this.get_nullable_path_(new_path_ptr, new_path_len);
    if (Number.isInteger(new_path)) {
      return new_path;
    }

    return this.handle_path_symlink(old_path, fd, new_path);
  }

  sys_path_unlink_file(fd, path_ptr, path_len) {
    const path = this.get_nullable_path_(path_ptr, path_len);
    if (Number.isInteger(path)) {
      return path;
    }

    return this.handle_path_unlink_file(fd, path);
  }

  sys_poll_oneoff(...args) {
    //poll_oneoff(in: ConstPointer<subscription>, out: Pointer<event>, nsubscriptions: size) -> (errno, size)
    return WASI.errno.ENOSYS;
  }

  sys_proc_exit(status) {
    this.handle_proc_exit(status);

    // Handler shouldn't return, but just in case.
    throw new util.CompletedProcessError({status});
  }

  sys_proc_raise(signal) {
    this.handle_proc_raise(signal);

    // Handler shouldn't return, but just in case.
    throw new util.CompletedProcessError({signal});
  }

  /**
   * Fill the supplied buffer with random bytes.
   *
   * @param {number} buf Offset of the buffer to fill in WASM memory.
   * @param {number} buf_len Length of buf in bytes.
   * @return {WASI.errno} The result from the syscall handler.
   */
  sys_random_get(buf, buf_len) {
    const bytes = this.getMem_(buf, buf + buf_len);
    return this.handle_random_get(bytes);
  }

  sys_sched_yield() {
    return this.handle_sched_yield();
  }

  sys_sock_recv(fd, ri_data, ri_flags, ro_datalen_ptr, ro_flags_ptr) {
    return WASI.errno.ENOSYS;
  }

  sys_sock_send(fd, si_data, si_flags, so_datalen_ptr) {
    return WASI.errno.ENOSYS;
  }

  sys_sock_shutdown(fd, how) {
    return this.handle_sock_shutdown(fd, how);
  }
}
