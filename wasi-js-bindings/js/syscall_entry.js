// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Syscall entry APIs.  Programs call these directly, and they
 * rely on syscall handlers to implement the actual syscall.
 */

import {WasiView} from './dataview.js';
import * as util from './util.js';
import * as WASI from './wasi.js';

/**
 * Base class for creating syscall entries.
 *
 * @unrestricted https://github.com/google/closure-compiler/issues/1737
 * @extends {SyscallEntry}
 * @abstract
 */
export class Base {
  /**
   * @param {{
   *   sys_handlers: (!Array<!Object>|undefined),
   *   process: !Process,
   *   trace: (boolean|undefined),
   *   debug: (boolean|undefined),
   * }} options
   */
  constructor({sys_handlers, process, trace, debug}) {
    this.enableTrace_ = trace;
    this.enableDebug_ = debug;
    this.process_ = process;
    this.bindHandlers_(sys_handlers);
    /** @type {string} */
    this.namespace = '';
  }

  /** @override */
  setProcess(process) {
    this.process_ = process;
  }

  /**
   * @param {!WASI_t.pointer} base
   * @param {!WASI_t.pointer=} end
   * @return {!Uint8Array}
   */
  getMem_(base, end = undefined) {
    return this.process_.getMem(base, end);
  }

  /**
   * @param {!WASI_t.pointer} base
   * @param {!WASI_t.u32=} offset
   * @return {!WasiView}
   * @suppress {checkTypes} WasiView$$module$js$dataview naming confusion.
   */
  getView_(base, offset = undefined) {
    return this.process_.getView(base, offset);
  }

  /**
   * Log a debug message.
   *
   * @param {...*} args The message to log.
   */
  debug(...args) {
    if (!this.enableDebug_) {
      return;
    }

    this.process_.debug(...args);
  }

  /**
   * Start a group of log messages.
   *
   * @param {...*} args The header message to log.
   */
  logGroup(...args) {
    this.process_.logGroup(...args);
  }

  /**
   * Log an error message.
   *
   * @param {...*} args The message to log.
   */
  logError(...args) {
    this.process_.logError(...args);
  }

  /**
   * @param {function(*): !WASI_t.errno} func
   * @param {string} prefix
   * @param {...} args
   * @return {!WASI_t.errno}
   */
  traceCall(func, prefix, ...args) {
    this.logGroup(`${prefix}(${args.join(', ')})`);
    const ret = func(...args);
    if (typeof ret === 'number') {
      let style;
      switch (ret) {
        case WASI.errno.ESUCCESS:
          style = '';
          break;
        case WASI.errno.ENOSYS:
          style = 'font-weight: bold; color: #fc036f';
          break;
        default:
          style = 'color: #d44';
          break;
      }
      this.debug(`${prefix} -> %c${util.strerror(ret)}`, style);
    } else {
      this.debug(`${prefix} ->`, ret);
    }
    console.groupEnd();
    return ret;
  }

  /**
   * @param {function(*)} func
   * @param {string} prefix
   * @return {function(*)}
   */
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

  /**
   * @param {!Function} func
   * @param {...*} args
   * @return {*}
   */
  unhandledExceptionWrapper_(func, ...args) {
    try {
      return func(...args);
    } catch (e) {
      if (e instanceof util.CompletedProcessError) {
        return e;
      }
      this.logError(`Error: ${func?.name}(${args}): ${e}\n${e.stack}`);
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
   * @param {!Array<!Object>=} handlers Array of SyscallHandler objects.
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
   *
   * @return {!Array<string>}
   */
  getSyscalls_() {
    return Array.from(util.getAllPropertyNames(this))
      .filter((/** @type {string} */ key) => key.startsWith('sys_'));
  }

  /** @override */
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
export class WasiPreview1 extends Base {
  constructor(...args) {
    super(...args);
    this.namespace = 'wasi_snapshot_preview1';
  }

  /**
   * @param {!WASI_t.pointer} ptr
   * @param {!WASI_t.u32} len
   * @return {?string|number}
   */
  get_nullable_path_(ptr, len) {
    let ret = null;
    if (ptr) {
      const td = new TextDecoder();
      const buf = this.getMem_(ptr, ptr + len);
      try {
        ret = td.decode(buf);
      } catch (e) {
        return WASI.errno.EFAULT;
      }
    }
    return ret;
  }

  /** @override */
  sys_args_get(argv, argv_buf) {
    const ret = this.handle_args_get();
    if (typeof ret === 'number') {
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

  /** @override */
  sys_args_sizes_get(argc, argv_size) {
    const ret = this.handle_args_sizes_get();
    if (typeof ret === 'number') {
      return ret;
    }

    const dvSize = this.getView_(argc, 4);
    const dvBuf = this.getView_(argv_size, 4);
    dvSize.setUint32(0, ret.argc, true);
    dvBuf.setUint32(0, ret.argv_size, true);
    return WASI.errno.ESUCCESS;
  }

  /**
   * @override
   * @suppress {checkTypes} https://github.com/google/closure-compiler/commit/ee80bed57fe1ee93876fee66ad77e025a345c7a7
   */
  sys_clock_res_get(clockid, resolution_ptr) {
    const ret = this.handle_clock_res_get(clockid);
    if (typeof ret === 'number') {
      return ret;
    }

    const dv = this.getView_(resolution_ptr, 8);
    dv.setBigUint64(0, ret.res, true);
    return WASI.errno.ESUCCESS;
  }

  /**
   * @override
   * @suppress {checkTypes} https://github.com/google/closure-compiler/commit/ee80bed57fe1ee93876fee66ad77e025a345c7a7
   */
  sys_clock_time_get(clockid, precision, time_ptr) {
    // TODO: Figure out what to do with precision.
    const ret = this.handle_clock_time_get(clockid);
    if (typeof ret === 'number') {
      return ret;
    }

    const dv = this.getView_(time_ptr, 8);
    dv.setBigUint64(0, ret.now, true);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  sys_environ_get(envp, env_buf) {
    const ret = this.handle_environ_get();
    if (typeof ret === 'number') {
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

  /** @override */
  sys_environ_sizes_get(env_size, env_buf) {
    const ret = this.handle_environ_sizes_get();
    if (typeof ret === 'number') {
      return ret;
    }

    const dvSize = this.getView_(env_size, 4);
    const dvBuf = this.getView_(env_buf, 4);
    // Include one extra for NULL terminator.
    // TODO(vapier): Is this necessary ?
    dvSize.setUint32(0, ret.length + 1, true);
    dvBuf.setUint32(0, ret.size, true);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  sys_fd_advise(fd, offset, len, advice) {
    return this.handle_fd_advise(fd, offset, len, advice);
  }

  /** @override */
  sys_fd_allocate(fd, offset, len) {
    return this.handle_fd_allocate(fd, offset, len);
  }

  /** @override */
  sys_fd_close(fd) {
    return this.handle_fd_close(fd);
  }

  /** @override */
  sys_fd_datasync(fd) {
    return this.handle_fd_datasync(fd);
  }

  /** @override */
  sys_fd_fdstat_get(fd, buf) {
    const ret = this.handle_fd_fdstat_get(fd);
    if (typeof ret === 'number') {
      return ret;
    }

    const dv = this.getView_(buf);
    dv.setFdstat(0, ret, true);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  sys_fd_fdstat_set_flags(fd, fdflags) {
    return this.handle_fd_fdstat_set_flags(fd, fdflags);
  }

  /** @override */
  sys_fd_fdstat_set_rights(fd, fs_rights_base, fs_rights_inheriting) {
    return this.handle_fd_fdstat_set_rights(
        fd, fs_rights_base, fs_rights_inheriting);
  }

  /** @override */
  sys_fd_filestat_get(fd, filestat_ptr) {
    const ret = this.handle_fd_filestat_get(fd);
    if (typeof ret === 'number') {
      return ret;
    }

    const dv = this.getView_(filestat_ptr);
    dv.setFilestat(0, ret, true);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  sys_fd_filestat_set_size(fd, size) {
    return this.handle_fd_filestat_set_size(fd, size);
  }

  /** @override */
  sys_fd_filestat_set_times(fd, atim, mtim, fst_flags) {
    return this.handle_fd_filestat_set_times(fd, atim, mtim, fst_flags);
  }

  /** @override */
  sys_fd_pread(fd, iovs_ptr, iovs_len, offset, nread_ptr) {
    const dvIovs = this.getView_(iovs_ptr);
    let nread = 0;
    let iovs_off = 0;
    for (let i = 0; i < iovs_len; ++i) {
      const iovec = dvIovs.getIovec(iovs_off, true);
      const buf = this.getMem_(iovec.buf, iovec.buf + iovec.buf_len);
      const ret = this.handle_fd_pread(fd, iovec.buf_len, offset);
      if (typeof ret === 'number') {
        if (ret === WASI.errno.ESUCCESS) {
          nread += iovec.buf_len;
        } else {
          return ret;
        }
      } else {
        if (ret.buf !== undefined) {
          const u8 = new Uint8Array(ret.buf);
          buf.set(u8);
          if (ret.nread === undefined) {
            ret.nread = u8.length;
          }
        }
        nread += ret.nread;
      }
      offset += BigInt(nread);
      iovs_off += iovec.struct_size;
    }

    const dvNread = this.getView_(nread_ptr, 4);
    dvNread.setUint32(0, nread, true);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  sys_fd_prestat_dir_name(fd, path_ptr, path_len) {
    const ret = this.handle_fd_prestat_dir_name(fd);
    if (typeof ret === 'number') {
      return ret;
    }

    const buf = this.getMem_(path_ptr, path_ptr + path_len);
    const te = new TextEncoder();
    te.encodeInto(ret.path, buf);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  sys_fd_prestat_get(fd, buf) {
    const ret = this.handle_fd_prestat_get(fd);
    if (typeof ret === 'number') {
      return ret;
    }

    const dv = this.getView_(buf, 8);
    dv.setUint8(0, 0 /* __WASI_PREOPENTYPE_DIR */);

    const te = new TextEncoder();
    dv.setUint32(4, te.encode(ret.path).length, true);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  sys_fd_pwrite(fd, iovs_ptr, iovs_len, offset, nwritten_ptr) {
    const dvIovs = this.getView_(iovs_ptr);
    let nwritten = 0;
    let iovs_off = 0;
    for (let i = 0; i < iovs_len; ++i) {
      const iovec = dvIovs.getIovec(iovs_off, true);
      const buf = this.getMem_(iovec.buf, iovec.buf + iovec.buf_len);
      const ret = this.handle_fd_pwrite(fd, Uint8Array.from(buf), offset);
      if (typeof ret === 'number') {
        if (ret === WASI.errno.ESUCCESS) {
          nwritten += iovec.buf_len;
        } else {
          return ret;
        }
      } else {
        nwritten += ret.nwritten;
      }
      offset += BigInt(nwritten);
      iovs_off += iovec.struct_size;
    }

    const dvWritten = this.getView_(nwritten_ptr, 4);
    dvWritten.setUint32(0, nwritten, true);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  sys_fd_read(fd, iovs_ptr, iovs_len, nread_ptr) {
    const dvIovs = this.getView_(iovs_ptr);
    let nread = 0;
    let iovs_off = 0;
    for (let i = 0; i < iovs_len; ++i) {
      const iovec = dvIovs.getIovec(iovs_off, true);
      const buf = this.getMem_(iovec.buf, iovec.buf + iovec.buf_len);
      const ret = this.handle_fd_read(fd, iovec.buf_len);
      if (typeof ret === 'number') {
        if (ret === WASI.errno.ESUCCESS) {
          nread += iovec.buf_len;
        } else {
          return ret;
        }
      } else {
        if (ret.buf !== undefined) {
          const u8 = new Uint8Array(ret.buf);
          if (u8.length > iovec.buf_len) {
            this.logError('handle_fd_read returned too many bytes: ' +
                          `${u8.length} > ${iovec.buf_len}`);
          }
          buf.set(u8);
          if (ret.nread === undefined) {
            ret.nread = u8.length;
          }
        }
        nread += ret.nread;
      }
      iovs_off += iovec.struct_size;
    }

    const dvNread = this.getView_(nread_ptr, 4);
    dvNread.setUint32(0, nread, true);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  sys_fd_readdir(fd, buf_ptr, buf_len, cookie, size_ptr) {
    const buf = this.getMem_(buf_ptr, buf_ptr + buf_len);
    const ret = this.handle_fd_readdir(fd, buf, cookie);
    if (typeof ret === 'number') {
      return ret;
    }

    const dv = this.getView_(size_ptr);
    dv.setUint32(0, ret.length, true);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  sys_fd_renumber(fd, to) {
    return this.handle_fd_renumber(fd, to);
  }

  /**
   * @override
   * @suppress {checkTypes} https://github.com/google/closure-compiler/commit/ee80bed57fe1ee93876fee66ad77e025a345c7a7
   */
  sys_fd_seek(fd, offset, whence, newoffset_ptr) {
    if (whence < 0 || whence > 2) {
      return WASI.errno.EINVAL;
    }

    const ret = this.handle_fd_seek(fd, offset, whence);
    if (typeof ret === 'number') {
      return ret;
    }

    const dv = this.getView_(newoffset_ptr, 8);
    dv.setBigUint64(0, ret.newoffset, true);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  sys_fd_sync(fd) {
    return this.handle_fd_sync(fd);
  }

  /**
   * @override
   * @suppress {checkTypes} https://github.com/google/closure-compiler/commit/ee80bed57fe1ee93876fee66ad77e025a345c7a7
   */
  sys_fd_tell(fd, offset_ptr) {
    const ret = this.handle_fd_tell(fd);
    if (typeof ret === 'number') {
      return ret;
    }

    const dv = this.getView_(offset_ptr, 8);
    dv.setBigUint64(0, ret.offset, true);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  sys_fd_write(fd, iovs_ptr, iovs_len, nwritten_ptr) {
    const dvIovs = this.getView_(iovs_ptr);
    let nwritten = 0;
    let iovs_off = 0;
    for (let i = 0; i < iovs_len; ++i) {
      const iovec = dvIovs.getIovec(iovs_off, true);
      const buf = this.getMem_(iovec.buf, iovec.buf + iovec.buf_len);
      const ret = this.handle_fd_write(fd, Uint8Array.from(buf));
      if (typeof ret === 'number') {
        if (ret === WASI.errno.ESUCCESS) {
          nwritten += iovec.buf_len;
        } else {
          return ret;
        }
      } else {
        nwritten += ret.nwritten;
      }
      iovs_off += iovec.struct_size;
    }

    const dvWritten = this.getView_(nwritten_ptr, 4);
    dvWritten.setUint32(0, nwritten, true);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  sys_path_create_directory(fd, path_ptr, path_len) {
    const path = this.get_nullable_path_(path_ptr, path_len);
    if (typeof path === 'number') {
      return path;
    }

    return this.handle_path_create_directory(fd, path);
  }

  /** @override */
  sys_path_filestat_get(fd, lookupflags, path_ptr, path_len, filestat_ptr) {
    const path = this.get_nullable_path_(path_ptr, path_len);
    if (typeof path === 'number') {
      return path;
    }

    const ret = this.handle_path_filestat_get(fd, lookupflags, path);
    if (typeof ret === 'number') {
      return ret;
    }

    const dv = this.getView_(filestat_ptr);
    dv.setFilestat(0, ret, true);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  sys_path_filestat_set_times(fd, flags, path_ptr, path_len, atim, mtim,
                              fst_flags) {
    const path = this.get_nullable_path_(path_ptr, path_len);
    if (typeof path === 'number') {
      return path;
    }

    return this.handle_path_filestat_set_times(
        fd, flags, path, atim, mtim, fst_flags);
  }

  /** @override */
  sys_path_link(old_fd, old_flags, old_path_ptr, old_path_len, new_fd,
                new_path_ptr, new_path_len) {
    const old_path = this.get_nullable_path_(old_path_ptr, old_path_len);
    if (typeof old_path === 'number') {
      return old_path;
    }

    const new_path = this.get_nullable_path_(new_path_ptr, new_path_len);
    if (typeof new_path === 'number') {
      return new_path;
    }

    return this.handle_path_link(old_fd, old_flags, old_path, new_fd, new_path);
  }

  /** @override */
  sys_path_open(dirfd, dirflags, path_ptr, path_len, o_flags, fs_rights_base,
                fs_rights_inheriting, fdflags, fd_ptr) {
    const path = this.get_nullable_path_(path_ptr, path_len);
    if (typeof path === 'number') {
      return path;
    }
    this.debug(`  path = "${path}"`);

    const ret = this.handle_path_open(
        dirfd, dirflags, path, o_flags, fs_rights_base, fs_rights_inheriting,
        fdflags);
    if (typeof ret === 'number') {
      return ret;
    }

    const dv = this.getView_(fd_ptr, 4);
    dv.setUint32(0, ret.fd, true);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  sys_path_readlink(fd, path_ptr, path_len, buf_ptr, buf_len, bufused_ptr) {
    const path = this.get_nullable_path_(path_ptr, path_len);
    if (typeof path === 'number') {
      return path;
    }

    const buf = this.getMem_(buf_ptr, buf_ptr + buf_len);
    const ret = this.handle_path_readlink(fd, path, buf);
    if (typeof ret === 'number') {
      return ret;
    }

    const dv = this.getView_(bufused_ptr);
    dv.setUint32(0, ret.length, true);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  sys_path_remove_directory(fd, path_ptr, path_len) {
    const path = this.get_nullable_path_(path_ptr, path_len);
    if (typeof path === 'number') {
      return path;
    }

    return this.handle_path_remove_directory(fd, path);
  }

  /** @override */
  sys_path_rename(fd, old_path_ptr, old_path_len, new_fd, new_path_ptr,
                  new_path_len) {
    const old_path = this.get_nullable_path_(old_path_ptr, old_path_len);
    if (typeof old_path === 'number') {
      return old_path;
    }

    const new_path = this.get_nullable_path_(new_path_ptr, new_path_len);
    if (typeof new_path === 'number') {
      return new_path;
    }

    return this.handle_path_rename(fd, old_path, new_fd, new_path);
  }

  /** @override */
  sys_path_symlink(old_path_ptr, old_path_len, fd, new_path_ptr, new_path_len) {
    const old_path = this.get_nullable_path_(old_path_ptr, old_path_len);
    if (typeof old_path === 'number') {
      return old_path;
    }

    const new_path = this.get_nullable_path_(new_path_ptr, new_path_len);
    if (typeof new_path === 'number') {
      return new_path;
    }

    return this.handle_path_symlink(old_path, fd, new_path);
  }

  /** @override */
  sys_path_unlink_file(fd, path_ptr, path_len) {
    const path = this.get_nullable_path_(path_ptr, path_len);
    if (typeof path === 'number') {
      return path;
    }

    return this.handle_path_unlink_file(fd, path);
  }

  /** @override */
  sys_poll_oneoff(subscriptions_ptr, events_ptr, nsubscriptions, nevents_ptr) {
    const dvNevents = this.getView_(nevents_ptr);
    if (nsubscriptions <= 0) {
      dvNevents.setUint32(0, 0, true);
      return WASI.errno.ESUCCESS;
    }

    const subscriptions = Array(nsubscriptions);
    const dvSubscriptions = this.getView_(subscriptions_ptr);
    let offset = 0;
    for (let i = 0; i < nsubscriptions; ++i) {
      const subscription = dvSubscriptions.getSubscription(offset, true);
      if (subscription.tag > WASI.eventtype.ENUM_END) {
        return WASI.errno.EINVAL;
      }
      subscriptions[i] = subscription;
      offset += subscription.struct_size;
    }

    const ret = this.handle_poll_oneoff(subscriptions);
    if (typeof ret === 'number') {
      return ret;
    }

    // TODO(vapier): This call does not belong here.  This should be in wassh.
    // But the current sys_poll_oneoff logic is not factored well for hooking.
    if (ret.signals !== undefined &&
        this.process_.instance_.exports.__wassh_signal_deliver !== undefined) {
      ret.signals.forEach(
          /** @type {{__wassh_signal_deliver: function(number)}} */ (
              this.process_.instance_.exports).__wassh_signal_deliver);
      if (ret.events.length === 0) {
        // If there are no other events, return EINTR so the caller knows that a
        // signal came in.  It should retry the call automatically.
        return WASI.errno.EINTR;
      }
    }

    const dvEvents = this.getView_(events_ptr);
    offset = 0;
    ret.events.forEach((event) => {
      dvEvents.setEvent(offset, event, true);
      offset += WasiView.event_t.struct_size;
    });
    dvNevents.setUint32(0, ret.events.length, true);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  sys_proc_exit(status) {
    this.handle_proc_exit(status);

    // Handler shouldn't return, but just in case.
    throw new util.CompletedProcessError({status});
  }

  /** @override */
  sys_proc_raise(signal) {
    this.handle_proc_raise(signal);

    // Handler shouldn't return, but just in case.
    throw new util.CompletedProcessError({signal});
  }

  /** @override */
  sys_random_get(buf, buf_len) {
    const bytes = this.getMem_(buf, buf + buf_len);
    return this.handle_random_get(bytes);
  }

  /** @override */
  sys_sched_yield() {
    return this.handle_sched_yield();
  }

  /** @override */
  sys_sock_recv(fd, ri_data_ptr, ri_data_len, ri_flags, ro_datalen_ptr,
                ro_flags_ptr) {
    if (ri_flags !== 0) {
      return WASI.errno.ENOTSUP;
    }
    return this.sys_fd_read(fd, ri_data_ptr, ri_data_len, ro_datalen_ptr);
  }

  /** @override */
  sys_sock_send(fd, si_data_ptr, si_data_len, si_flags, so_datalen_ptr) {
    if (si_flags !== 0) {
      return WASI.errno.ENOTSUP;
    }
    return this.sys_fd_write(fd, si_data_ptr, si_data_len, so_datalen_ptr);
  }

  /** @override */
  sys_sock_shutdown(fd, how) {
    return this.handle_sock_shutdown(fd, how);
  }
}
