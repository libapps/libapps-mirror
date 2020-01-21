// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Syscall handler APIs.  These actually implement syscalls.
 */

import * as WASI from './wasi.js';
import {SyscallLock} from './syscall_lock.js';
import * as util from './util.js';

/**
 * Base class for creating syscall handlers.
 */
export class Base {
  constructor() {
    this.process_ = null;
  }

  setProcess(process) {
    this.process_ = process;
  }

  debug(...args) {
    this.process_.debug(...args);
  }

  getHandlers_() {
    const gen = util.getAllPropertyNames(this);
    return new Set({
      [Symbol.iterator]: function* () {
        while (1) {
          const ele = gen.next();
          if (ele.value && ele.value.startsWith('handle_')) {
            yield ele.value;
          }
          if (ele.done) {
            break;
          }
        }
      },
    });
  }
}

/**
 * This handler dispatches all requests to a worker thread.
 */
export class ProxyWasiUnstable extends Base {
  constructor(worker, sab, handlers) {
    super();

    this.worker = worker;
    this.syscallLock = new SyscallLock(sab);

    handlers.forEach((handler) => {
      if (handler.startsWith('handle_') && !(handler in this)) {
        this[handler] = this.dispatch_.bind(this, handler.slice(7));
      }
    });
  }

  dispatch_(...args) {
    if (!this.syscallLock.lock()) {
      throw new Error('Overlapped syscall');
    }
    this.worker.postMessage('syscall', ...args);
    this.syscallLock.wait();
    const ret = this.syscallLock.getRetcode();
    if (ret == -1) {
      return this.syscallLock.getData();
    } else {
      return ret;
    }
  }

  handle_proc_exit(status) {
    this.worker.postMessage('exit', status);
    return new Promise(() => {});
  }

  handle_proc_raise(signal) {
    this.worker.postMessage('signal', signal);
    return new Promise(() => {});
  }
}

/**
 * How many nanoseconds in one millisecond.
 */
const kNanosecToMillisec = 1000000;

/**
 * This handler implements syscalls directly.
 */
export class DirectWasiUnstable extends Base {
  handle_args_get() {
    return {argv: this.process_.argv};
  }

  handle_args_sizes_get() {
    const te = new TextEncoder();
    const argv = this.process_.argv;
    return {
      argc: argv.length,
      argv_size: argv.reduce((acc, str) => acc + te.encode(str).length + 1, 0),
    };
  }

  handle_clock_res_get(clockid) {
    switch (clockid) {
      case WASI.clock.REALTIME:
        // JavaScript's Date.now is millisecond resolution.
        // performance.now provides microseconds, but browsers have disabled it
        // due to security concerns.
        return {res: BigInt(kNanosecToMillisec)};
      case WASI.clock.MONOTONIC:
        // performance.now is guaranteed to be monotonic.
        return {res: BigInt(1)};
      default:
        return WASI.errno.EINVAL;
    }
  }

  handle_clock_time_get(clockid) {
    switch (clockid) {
      case WASI.clock.REALTIME: {
        // Convert milliseconds to nanoseconds.
        return {now: BigInt(Date.now()) * BigInt(kNanosecToMillisec)};
      }
      case WASI.clock.MONOTONIC: {
        return {now: BigInt(Math.floor(performance.now() * 1000000000))};
      }
      default:
        return WASI.errno.EINVAL;
    }
  }

  flattenEnviron_() {
    const ret = [];
    Object.entries(this.process_.environ).forEach(
        ([key, val]) => ret.push(`${key}=${val}`));
    return ret;
  }

  handle_environ_get() {
    return {env: this.flattenEnviron_()};
  }

  handle_environ_sizes_get() {
    const te = new TextEncoder();
    const env = this.flattenEnviron_();
    return {
      length: env.length,
      size: env.reduce((acc, str) => acc + te.encode(str).length + 1, 0),
    };
  }

  handle_fd_datasync(fd) {
    return WASI.errno.ESUCCESS;
  }

  handle_fd_sync(fd) {
    return WASI.errno.ESUCCESS;
  }

  handle_proc_exit(status) {
    throw new util.CompletedProcessError({status});
  }

  handle_proc_raise(signal) {
    throw new util.CompletedProcessError({signal});
  }

  handle_random_get(bytes) {
    // The crypto calls cannot operate on shared memory, so an additional copy
    // to a non-shared type is required. Other types of syscall will be able to
    // operate directly on the memory supplied.
    // https://github.com/w3c/webcrypto/issues/213
    if (0 && bytes instanceof SharedArrayBuffer) {
      const u8 = new Uint8Array(bytes);
      const temp = new Uint8Array(u8.length);
      crypto.getRandomValues(temp);
      u8.set(temp);
    } else {
      crypto.getRandomValues(bytes);
    }
    return WASI.errno.ESUCCESS;
  }

  handle_sched_yield() {
    return WASI.errno.ESUCCESS;
  }
}
