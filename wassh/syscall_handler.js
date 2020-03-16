// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Synchronous handling of syscalls on the main thread.
 */

// The SyscallHandler class requires the use of
// --enable-experimental-web-platform-features. Importing web workers as modules
// in their own right should land in Chrome 80.

import {SyscallLock} from './syscall_lock.js';
import * as WASI from '../wasi-js-bindings/js/wasi.js';

/**
 * Receive syscall requets from WASI runtimes, assumes the message has been
 * posted in an event type, which is passed to inbound() to dispatch it to the
 * correct function.
 */
export class SyscallHandler {
  /**
   * Creates an instance of SyscallHandler.
   */
  constructor() {
    // This sharedArraybuffer holds both the lock token and the syscall result.
    this.sab = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * 2);
    this.syscallLock = new SyscallLock(this.sab);
  }

  /**
   * Handles incoming syscall requets from the worker, the worker must place the
   * name of the target syscall function in 'name' and any parameters to the
   * function must be supplied in an iterable type, even when there is only one
   * parameter.
   *
   * @param {MessageEvent} e Incoming message from WasshWasiRuntime.
   */
  inbound(e) {
    console.log('SyscallHandler: Message received from main script');
    console.log(`passed data is : ${e.data}`);

    const targetFunction = e.data.name;
    const targetParams = e.data.params;

    // Lookup the target function.
    const func = this[targetFunction];

    // If the target function is not found indicate to the caller we don't
    // handle this syscall.
    let retcode = WASI.errno.ENOSYS;
    if (func) {
      retcode = func.apply(this, targetParams);
    }
    this.syscallLock.setRetcode(retcode);

    // Unblock the caller, who must have acquired the lock and now be in the
    // waiting state with successive calls to lock() and wait().
    this.syscallLock.unlock();
  }

  /**
   * Fill the supplied region with random values, suitable for RNG seeding.
   *
   * @param {Uint8Array} region Array to overwrite with random bytes.
   * @return {WASI.errno} Syscall result.
   */
  random_get(region) {
    console.log('entered random get in syscallworker');

    // The crypto calls cannot operate on shared memory, so an additional copy
    // to a non-shared type is required. Other types of syscall will be able to
    // operate directly on the memory supplied.
    const temp = region.slice(0);
    self.crypto.getRandomValues(temp);
    region.set(temp);

    return WASI.errno.ESUCCESS;
  }
}
