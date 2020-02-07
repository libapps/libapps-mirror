// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview The wassh WASI runtime glue layers.
 */

import {SyscallLock} from './syscall_lock.js';
import * as WASI from './js/wasi.js';

export class WasshWasiWorker {
  async run(prog_path, syscall_lock) {
    this.runtime = new WasshWasiRuntime({
      argv: [prog_path],
      environ: {
        'HOME': '/',
        'USER': 'wassh',
        'TERM': 'xterm',
      },
      io: {
        write: this.write,
        debug: (str) => console.log(str),
      },
      syscall: {
        lock_sab: syscall_lock,
      }
    });

    // TODO(ajws@): investigate if we can back the memory supplied to the WASM
    // runtime with a SharedArrayBuffer
    const imports = this.runtime.getImports();

    this.runtime.io.write(`> Loading ${prog_path}\n`);
    let instance;
    try {
      const result =
          await WebAssembly.instantiateStreaming(fetch(prog_path), imports);
      this.instance = result.instance;
      this.runtime.setInstance(this.instance);
    } catch (e) {
      this.runtime.io.write(`> Loading failure: ${e}\n`);
      return;
    }
    try {
      this.runtime.io.write(`> Running ${prog_path}\n`);
      this.instance.exports._start();
      // If we get here, the program returned 0 from main.
      // If it returned non-zero, or called exit() with any value (0 or
      // nonzero), then proc_exit will be used instead.
      this.runtime.io.write('\n> exited normally');
    } catch (e) {
      this.runtime.io.write(`\n> Runtime failure: ${e}\n${e.stack}`);
    }
  }

  // Post back to the main therad to update the UI.
  write(str) {
    self.postMessage({type: 'console_event', message: str});
  }
}

/**
 */
class FdMap extends Map {
  constructor() {
    super([
      [0, '/dev/stdin'],
      [1, '/dev/stdout'],
      [2, '/dev/stderr'],
      // WASI requires the pre-opened paths start at 3.
      [3, '/'],
      [4, '/dev/'],
    ]);
    this.next_ = 50;
  }

  next() {
    return this.next_++;
  }
}

/**
 * ArrayBuffer,offset combination. On reflection this is rather heavyweight, and
 * we could simply attach a '.offset' property to the SharedArrayBuffers that
 * are passed to the main therad.
 */
class TrackedMemoryRegion {
  constructor(sharedArray, offset) {
    this.sharedArray = sharedArray;
    this.offset = offset;
  }
}

/**
 * How many nanoseconds in one millisecond.
 */
const kNanosecToMillisec = 1000000;

/**
 * The runtime glue between the JS & WASM worlds.
 */
export class WasshWasiRuntime {
  constructor(options = {}) {
    this.argv = options.argv || [];
    this.environ = options.environ || {};
    this.io = options.io;
    this.instance = null;
    this.wasi_unstable = new WasiUnstable(this);
    this.wassh_experimental = new WasshExperimental(this);
    this.fds = new FdMap();

    // This Lock operates on the shared memory allocated in the SyscallHandler
    // on the main thread.
    this.lock_sab = options.syscall.lock_sab;
    this.syscall_lock = new SyscallLock(this.lock_sab);
  }

  setInstance(instance) {
    this.instance = instance;
  }

  /**
   * Construct a TrackedMemoryRegion from the WASM memory. This type retains its
   * offset, so that it can be written back to the WASM memory after
   * modification.
   *
   * @param {number} base Starting offset in WASM memory to copy from.
   * @param {number} end End offset in WASM memory.
   * @return {TrackedMemoryRegion} A new TrackedMemoryRegion.
   */
  getSharedMem(base, end) {
    const shared = new SharedArrayBuffer(end - base);
    const uint8 = new Uint8Array(shared);
    const original = this.getMem(base, end);
    uint8.set(original);
    return new TrackedMemoryRegion(uint8, base);
  }

  /**
   * Get a u8 view into the WASM memory.
   *
   * @param {number} base Starting offset in WASM memory to copy from.
   * @param {number} end End offset in WASM memory.
   * @return {Uint8Array}
   */
  getMem(base, end) {
    return new Uint8Array(this.instance.exports.memory.buffer)
        .subarray(base, end);
  }

  getView(base, length) {
    return new DataView(this.instance.exports.memory.buffer, base, length);
  }

  getImports() {
    return Object.assign(
        {}, this.wasi_unstable.getImports(),
        this.wassh_experimental.getImports());
  }
}

/**
 * Base syscall entry class.
 */
class SyscallEntry {
  constructor(runtime) {
    this.enableTrace_ = true;
    this.runtime = runtime;
  }

  getSharedMem_(...args) {
    return this.runtime.getSharedMem(...args);
  }

  getMem_(...args) {
    return this.runtime.getMem(...args);
  }

  getView_(...args) {
    return this.runtime.getView(...args);
  }

  debug(...args) {
    this.runtime.io.debug(...args);
  }

  /**
   * Trace the syscall entry.
   *
   * @param {!function(*)} func The wrapped function to call.
   * @param {string} prefix A short message to prefix the debug output.
   * @param {!Array<*>} args The arguments to the function.
   * @return {number} The syscall return value.
   */
  traceCall(func, prefix, ...args) {
    this.debug(`${prefix}(${args.join(', ')})`);
    const ret = func(...args);
    this.debug(`  -> ${ret}`);
    return ret;
  }

  /**
   * Create a wrapper func that traces the specified function.
   *
   * If tracing is not enabled, then return the function sans-wrapper.
   *
   * @param {!function(*)} func The function to wrap.
   * @param {string} prefix A short message to prefix the debug output.
   * @return {!function(*)} The function to call.
   */
  createTracer_(func, prefix) {
    if (this.enableTrace_) {
      return this.traceCall.bind(this, func, prefix);
    } else {
      return func;
    }
  }

  getSyscalls_() {
    // TODO: This only checks methods the class defined directly, not methods
    // it might have inherited.  Only way around this would be to walk the
    // prototype inheritance chain ourselves.  Or force classes to define the
    // set of syscalls it supports (somehow).
    return Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter((key) => key.startsWith('sys_'));
  }

  getImports() {
    const entries = {};
    this.getSyscalls_().forEach((key) => {
      entries[key.slice(4)] = this.createTracer_(
          this[key].bind(this), `entry: ${key}`);
    });
    const ret = {};
    ret[this.namespace] = entries;
    return ret;
  }
}

/**
 * WASI syscalls.
 */
class WasiUnstable extends SyscallEntry {
  constructor(runtime) {
    super(runtime);
    this.namespace = 'wasi_unstable';
    this.argv = runtime.argv;
  }

  flattenEnviron_() {
    const ret = [];
    Object.entries(this.runtime.environ).forEach(
        ([key, val]) => ret.push(`${key}=${val}`));
    return ret;
  }

  sys_environ_sizes_get(env_size, env_buf) {
    const dvSize = this.getView_(env_size, 4);
    const dvBuf = this.getView_(env_buf, 4);
    const env = this.flattenEnviron_();
    // Include one extra for NULL terminator.
    dvSize.setUint32(0, env.length + 1, true);
    // TODO: The length here is wrong as it's counting UTF-16 codeunits, not
    // bytes.
    dvBuf.setUint32(0, env.reduce((acc, str) => acc + str.length + 1, 0), true);
    return WASI.errno.ESUCCESS;
  }

  sys_environ_get(envp, env_buf) {
    const env = this.flattenEnviron_();
    const dvEnvp = this.getView_(envp, 4 * (env.length + 1));
    let ptr = env_buf;
    const te = new TextEncoder();
    for (let i = 0; i < env.length; ++i) {
      const buf = this.getMem_(ptr);
      dvEnvp.setUint32(i * 4, ptr, true);
      const bytes = te.encode(env[i]);
      buf.set(bytes);
      buf[bytes.length] = 0;
      ptr += bytes.length + 1;
    }
    // The NULL terminator.
    dvEnvp.setUint32(4 * env.length, 0, true);
    return WASI.errno.ESUCCESS;
  }

  sys_args_sizes_get(argc, argv_size) {
    const dvSize = this.getView_(argc, 4);
    const dvBuf = this.getView_(argv_size, 4);
    dvSize.setUint32(0, this.argv.length, true);
    // TODO: The length here is wrong as it's counting UTF-16 codeunits, not
    // bytes.
    dvBuf.setUint32(
        0, this.argv.reduce((acc, str) => acc + str.length + 1, 0), true);
    return WASI.errno.ESUCCESS;
  }

  sys_args_get(argv, argv_buf) {
    const dvArgv = this.getView_(argv, 4 * this.argv.length);
    let ptr = argv_buf;
    const te = new TextEncoder();
    for (let i = 0; i < this.argv.length; ++i) {
      const buf = this.getMem_(ptr);
      dvArgv.setUint32(i * 4, ptr, true);
      const bytes = te.encode(this.argv[i]);
      buf.set(bytes);
      buf[bytes.length] = 0;
      ptr += bytes.length + 1;
    }
    return WASI.errno.ESUCCESS;
  }

  sys_proc_exit(status) {
    throw Error(`Exit ${status}`);
  }

  sys_proc_raise(sig) {
    throw Error(`Signaled ${sig}`);
  }

  /**
   * Ask the main thread to perform a syscall. Execution will be blocked until
   * the main thread has called unlock() on the SyscallLock.
   *
   * @param {string} methodName The name of the target syscall handler
   *     function.
   * @param {Array} params Parameters to pass to the handler.
   * @return {WASI.errno} The result of invoking the syscall, or ENOSYS if the
   *     syscall is not implemented.
   */
  passToWorker_(methodName, params) {
    // Aquire the shared lock, the SyscallWorker will unlock this when it has
    // finished servicing our request.
    if (!this.runtime.syscall_lock.lock()) {
      throw new Error('Overlapped syscall');
    }

    this.debug('lock obtained');

    // The incoming array can contian TrackedMemoryRegion types, these must be
    // replaced with their SharedArrayBuffer instances so the syscall handlers
    // can operate on memory regions without knowledge of this type.
    // TODO(ajws@): just add a .offset property to the passed region instead.
    const cleanedArray = params.map((p) => {
      if (p instanceof TrackedMemoryRegion) {
        return p.sharedArray;
      } else {
        return p;
      }
    });

    // Invoke the syscall handler.
    postMessage({
      'type': 'syscall',
      'name': methodName,
      'params': cleanedArray,
    });
    this.debug('syscall handler message posted');

    // Wait for the SyscallWorker to unlock us, indicating it has finished
    // handling the syscall.
    this.runtime.syscall_lock.wait();
    this.debug('syscall handler complete, unlocked');

    // Get the result of the last syscall.
    const retcode = this.runtime.syscall_lock.getRetcode();
    if (retcode === WASI.errno.ENOSYS) {
      throw new Error(`Unhandled syscall : ${methodName}`);
    }

    // Writeback the updated memory.
    params.forEach((param) => {
      if (param.constructor !== TrackedMemoryRegion) {
        return;
      }

      const toUpdate = this.getMem_(
          param.offset, param.offset + param.sharedArray.byteLength);
      toUpdate.set(param.sharedArray);
    });

    this.debug('syscall worker has completed');

    // We're done, pass the return code of the syscall back to the WASM runtime.
    return retcode;
  }

  /**
   * Fill the supplied buffer with random bytes.
   *
   * @param {number} buf Offset of the buffer to fill in WASM memory.
   * @param {number} buf_len Length of buf in bytes.
   * @return {WASI.errno} The result from the syscall handler.
   */
  sys_random_get(buf, buf_len) {
    // TODO(ajws@): work out if we can dynamically get the calling function's
    // name inside pass_to_worker_(), preventing the caller from having to type
    // the name of their own function.

    // We construct a shared view of the WASM runtime's memory. The
    // SyscallHandler will operate on this shared memory and we will be
    // responsible for writing any updates back to the WASM runtime.
    return this.passToWorker_(
        'random_get', [this.getSharedMem_(buf, buf + buf_len)]);
  }

  sys_sched_yield() {
    return WASI.errno.ESUCCESS;
  }

  sys_clock_res_get(clockid, resolution) {
    const dv = this.getView_(resolution, 8);
    switch (clockid) {
      case WASI.clock.REALTIME:
        // JavaScript's Date.now is millisecond resolution.
        // performance.now provides microseconds, but browsers have disabled it
        // due to security concerns.
        dv.setBigUint64(0, BigInt(kNanosecToMillisec), true);
        return WASI.errno.ESUCCESS;
      case WASI.clock.MONOTONIC:
        // performance.now is guaranteed to be monotonic.
        dv.setBigUint64(0, BigInt(1), true);
        return WASI.errno.ESUCCESS;
      default:
        return WASI.errno.EINVAL;
    }
  }

  sys_clock_time_get(clockid, precision, precisionHi, time) {
    const dv = this.getView_(time, 8);
    switch (clockid) {
      case WASI.clock.REALTIME: {
        // Convert milliseconds to nanoseconds.
        const now = BigInt(Date.now()) * BigInt(kNanosecToMillisec);
        dv.setBigUint64(0, now, true);
        return WASI.errno.ESUCCESS;
      }
      case WASI.clock.MONOTONIC: {
        const now = BigInt(Math.floor(performance.now() * 1000000000));
        dv.setBigUint64(0, now, true);
        return WASI.errno.ESUCCESS;
      }
      default:
        return WASI.errno.EINVAL;
    }
  }

  sys_fd_prestat_get(fd, buf) {
    if (!this.runtime.fds.has(fd)) {
      return WASI.errno.EBADF;
    }

    // This func only operates on dirs.
    const path = this.runtime.fds.get(fd);
    if (!path.endsWith('/')) {
      return WASI.errno.ENOTDIR;
    }

    const dv = this.getView_(buf, 8);
    dv.setUint8(0, 0 /*__WASI_PREOPENTYPE_DIR*/, true);

    // NB: This doesn't handle non-ASCII correctly.
    dv.setUint32(4, path.length, true);

    return WASI.errno.ESUCCESS;
  }

  sys_fd_prestat_dir_name(fd, pathptr, path_len) {
    if (!this.runtime.fds.has(fd)) {
      return WASI.errno.EBADF;
    }

    // This func only operates on dirs.
    const path = this.runtime.fds.get(fd);
    if (!path.endsWith('/')) {
      return WASI.errno.ENOTDIR;
    }

    const buf = this.getMem_(pathptr, pathptr + path_len);
    const te = new TextEncoder();
    te.encodeInto(path, buf);

    return WASI.errno.ESUCCESS;
  }

  sys_fd_fdstat_get(fd, buf) {
    if (!this.runtime.fds.has(fd)) {
      return WASI.errno.EBADF;
    }

    // This func only operates on dirs.
    const path = this.runtime.fds.get(fd);
    if (!path.endsWith('/')) {
      return WASI.errno.ENOTDIR;
    }

    const dv = this.getView_(buf, 24);
    /*
    typedef struct __wasi_fdstat_t {
      __wasi_filetype_t fs_filetype;         u8
      u8 pad;
      __wasi_fdflags_t fs_flags;             u16
      u32 pad;
      __wasi_rights_t fs_rights_base;        u64
      __wasi_rights_t fs_rights_inheriting;  u64
    } __wasi_fdstat_t;
    */
    dv.setUint8(0, WASI.filetype.DIRECTORY, true);
    dv.setUint16(2, 0, true);
    dv.setBigUint64(8, BigInt(0xffffffffff), true);
    dv.setBigUint64(16, BigInt(0xffffffffff), true);
    return WASI.errno.ESUCCESS;
  }

  sys_fd_close(...args) {
    return WASI.errno.ENOSYS;
  }

  sys_fd_seek(...args) {
    return WASI.errno.ENOSYS;
  }

  sys_fd_sync(fd) {
    return WASI.errno.ESUCCESS;
  }

  sys_fd_write(fd, iovs, iovs_len, nwritten) {
    // const fn = fd == 1 ? console.error : console.info;
    let ret = 0;
    for (let i = 0; i < iovs_len; ++i) {
      const dv = this.getView_(iovs + (8 * i), 8);
      const bufptr = dv.getUint32(0, true);
      const buflen = dv.getUint32(4, true);
      const buf = this.getMem_(bufptr, bufptr + buflen);
      const td = new TextDecoder();
      this.debug(`  {buf=${buf}, len=${buflen}}`);
      this.runtime.io.write(td.decode(buf));
      ret += buflen;
    }
    const dvWritten = this.getView_(nwritten, 4);
    dvWritten.setUint32(0, ret, true);
    return WASI.errno.ESUCCESS;
  }

  sys_fd_filestat_get(...args) {
    return WASI.errno.ENOSYS;
  }

  sys_fd_fdstat_set_flags(...args) {
    return WASI.errno.ENOSYS;
  }

  sys_fd_read(fd, iovs, iovs_len, nread) {
    const dv = this.getView_(nread, 4);
    dv.setUint32(0, 0, true);
    return WASI.errno.ENOSYS;
  }

  sys_path_open(
      dirfd, dirflags, pathptr, path_len, o_flags, fs_rights_baseLo,
      fs_rights_baseHi, fs_rights_inheritingLo, fs_rights_inheritingHi,
      fs_flags, fdptr) {
    if (!this.runtime.fds.has(dirfd)) {
      return WASI.errno.EBADF;
    }

    const dirpath = this.runtime.fds.get(dirfd);
    if (!dirpath.endsWith('/')) {
      return WASI.errno.ENOTDIR;
    }

    const buf = this.getMem_(pathptr, pathptr + path_len);
    const td = new TextDecoder();
    const path = td.decode(buf);
    this.debug(`  path=${path}`);
    const fd = this.runtime.fds.next();
    const dv = this.getView_(fdptr, 4);
    dv.setUint32(0, fd, true);
    this.runtime.fds.set(fd, dirpath + path);

    return WASI.errno.ESUCCESS;
  }

  sys_path_create_directory(...args) {
    return WASI.errno.ENOSYS;
  }

  sys_path_link(...args) {
    return WASI.errno.ENOSYS;
  }

  sys_path_unlink_file(...args) {
    return WASI.errno.ENOSYS;
  }

  sys_path_rename(...args) {
    return WASI.errno.ENOSYS;
  }

  sys_path_filestat_get(...args) {
    return WASI.errno.ENOSYS;
  }

  sys_poll_oneoff(...args) {
    return WASI.errno.ENOSYS;
  }

  sys_path_remove_directory(...args) {
    return WASI.errno.ENOSYS;
  }

  sys_fd_readdir(...args) {
    return WASI.errno.ENOSYS;
  }

  sys_sock_recv(...args) {
    return WASI.errno.ENOSYS;
  }

  sys_sock_shutdown(...args) {
    return WASI.errno.ENOSYS;
  }
}

/**
 * WASSH syscall extensions.
 */
class WasshExperimental extends SyscallEntry {
  constructor(runtime) {
    super(runtime);
    this.namespace = 'wassh_experimental';
  }

  sys_sock_create(sock, domain, type) {
    return WASI.errno.ENOSYS;
  }

  sys_sock_connect(sock, domain, addr, port) {
    return WASI.errno.ENOSYS;
  }

  sys_test_func(...args) {
    return WASI.errno.ENOSYS;
  }
}

const w = new WasshWasiWorker();

addEventListener('message', function(e) {
  const type = e.data.type;

  // Receive the program path and the shared buffer for the lock from the main
  // thread.
  if (type == 'run') {
    const prog_path = e.data.prog_path;
    const syscall_lock_sab = e.data.lock_sab;
    w.run(prog_path, syscall_lock_sab);
  }
});
