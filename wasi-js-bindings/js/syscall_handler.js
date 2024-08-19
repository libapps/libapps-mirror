// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Syscall handler APIs.  These actually implement syscalls.
 */

import {SyscallLock} from './syscall_lock.js';
import * as util from './util.js';
import * as WASI from './wasi.js';

/**
 * Base class for creating syscall handlers.
 *
 * @abstract
 * @extends {SyscallHandler}
 */
export class Base {
  constructor() {
    /** @type {?Process} */
    this.process_ = null;
  }

  /** @override */
  setProcess(process) {
    this.process_ = process;
  }

  debug(...args) {
    this.process_.debug(...args);
  }

  getHandlers_() {
    const gen = util.getAllPropertyNames(this);
    return new Set(/** @type {!Iterable<string>} */ ({
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
    }));
  }
}

/**
 * This handler dispatches all requests to a worker thread.
 *
 * @unrestricted https://github.com/google/closure-compiler/issues/1737
 */
export class ProxyWasiPreview1 extends Base {
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

  /** @override */
  handle_proc_exit(status) {
    this.worker.postMessage('exit', status);
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  handle_proc_raise(signal) {
    this.worker.postMessage('signal', signal);
    return WASI.errno.ESUCCESS;
  }
}

/**
 * How many nanoseconds in one millisecond.
 */
const kNanosecToMillisec = 1000000;

/**
 * This handler implements syscalls directly.
 */
export class DirectWasiPreview1 extends Base {
  /** @override */
  handle_args_get() {
    return {argv: this.process_.argv};
  }

  /** @override */
  handle_args_sizes_get() {
    const te = new TextEncoder();
    const argv = this.process_.argv;
    return {
      argc: argv.length,
      argv_size: argv.reduce((acc, str) => acc + te.encode(str).length + 1, 0),
    };
  }

  /** @override */
  handle_clock_res_get(clockid) {
    switch (clockid) {
      case WASI.clock.REALTIME:
        // JavaScript's Date.now is millisecond resolution.
        // performance.now provides microseconds, but browsers have disabled it
        // due to security concerns.
        return {res: BigInt(kNanosecToMillisec)};
      case WASI.clock.MONOTONIC:
        // performance.now is guaranteed to be monotonic and provides
        // microsecond resolution.
        return {res: BigInt(1000)};
      default:
        return WASI.errno.EINVAL;
    }
  }

  /** @override */
  handle_clock_time_get(clockid) {
    switch (clockid) {
      case WASI.clock.REALTIME: {
        // Convert milliseconds to nanoseconds.
        return {now: BigInt(Date.now()) * BigInt(kNanosecToMillisec)};
      }
      case WASI.clock.MONOTONIC: {
        return {
          now: BigInt(Math.floor(performance.now() * kNanosecToMillisec)),
        };
      }
      default:
        return WASI.errno.EINVAL;
    }
  }

  /** @return {!Array<string>} */
  flattenEnviron_() {
    const ret = [];
    Object.entries(this.process_.environ).forEach(
        ([key, val]) => ret.push(`${key}=${val}`));
    return ret;
  }

  /** @override */
  handle_environ_get() {
    return {env: this.flattenEnviron_()};
  }

  /** @override */
  handle_environ_sizes_get() {
    const te = new TextEncoder();
    const env = this.flattenEnviron_();
    return {
      length: env.length,
      size: env.reduce((acc, str) => acc + te.encode(str).length + 1, 0),
    };
  }

  /** @override */
  handle_fd_datasync(fd) {
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  handle_fd_sync(fd) {
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  handle_proc_exit(status) {
    this.process_.exit(status);
    throw new util.CompletedProcessError({status});
  }

  /** @override */
  handle_poll_oneoff(subscriptions) {
    // We can handle clock events only.
    const events = [];
    const now = BigInt(Date.now());

    // Find the earliest clock timeout.
    let timeout;
    let userdata;
    subscriptions.forEach((subscription) => {
      if (subscription.tag === WASI.eventtype.CLOCK) {
        // The standard C lib doesn't use other clocks, so this is future-proof.
        if (subscription.clock.id !== WASI.clock.REALTIME) {
          return WASI.errno.ENOTSUP;
        }

        let subTimeout;
        // The timeout is in nanoseconds.  We can do milliseconds at best.
        subTimeout = subscription.clock.timeout / BigInt(kNanosecToMillisec);
        if ((subscription.clock.flags & 1) === 0) {
          // The timeout is relative.
          subTimeout += now;
        }

        if (!timeout || subTimeout < timeout) {
          userdata = subscription.userdata;
          timeout = subTimeout;
        }
      }
    });

    // If there's a timeout, wait for it.
    if (timeout !== undefined) {
      events.push(/** @type {!WASI_t.event} */({
        userdata: userdata,
        error: WASI.errno.ESUCCESS,
        type: WASI.eventtype.CLOCK,
        fd_readwrite: {
          flags: 0,
          nbytes: 0n,
        },
      }));

      while (Date.now() < timeout) {
        // Burn the cpu.
      }
    } else {
      // If we found no clock events, but there are other events, then fail.
      if (subscriptions.length) {
        return WASI.errno.ENOTSUP;
      }
    }

    return {events};
  }

  /** @override */
  handle_proc_raise(signal) {
    throw new util.CompletedProcessError({signal});
  }

  /** @override */
  handle_random_get(bytes) {
    // The crypto calls cannot operate on shared memory, so an additional copy
    // to a non-shared type is required. Other types of syscall will be able to
    // operate directly on the memory supplied.
    // https://github.com/w3c/webcrypto/issues/213
    if (bytes instanceof SharedArrayBuffer) {
      const u8 = new Uint8Array(bytes);
      const temp = new Uint8Array(u8.length);
      crypto.getRandomValues(temp);
      u8.set(temp);
    } else {
      const temp = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
      crypto.getRandomValues(temp);
    }
    return WASI.errno.ESUCCESS;
  }

  /** @override */
  handle_sched_yield() {
    return WASI.errno.ESUCCESS;
  }
}
