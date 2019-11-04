// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Shared locking structure suitable for synchronising syscalls
 * between webworkers.
 */

/**
 * Locking type that's more analagous to a Win32-style signal. This class
 * creates locking semantics and a return code around a piece of shared memory
 * supplied at construction time. This lets two threads share a communications
 * channel, as one thread can lock() and wait() while another thread performs
 * the unlock() when execution in the original thread should continue.
 */
export class SyscallLock {
  /**
   * Creates an instance of SyscallLock.
   *
   * @param {SharedArrayBuffer!} shared_buffer Shared memory for this lock.
   */
  constructor(shared_buffer) {
    this.UNLOCKED = 0;
    this.LOCKED = 1;

    // Must have space for 2 Int32 types in this shared memory buffer, the lock
    // will live at |lockIndex| in the shared_buffer, the return code will live
    // at |retcodeIndex|.
    this.sabArr = new Int32Array(shared_buffer, 0, 2);
    this.lockIndex = 0;
    this.retcodeIndex = 1;
  }

  /**
   * Sets |lockIndex| to LOCKED, the caller must *not* already hold the lock
   * when making this call.
   *
   * @return {boolean} True if the lock was acquired, False otherwise.
   */
  lock() {
    // TODO(ajws@): Check if the lock is already held.
    return this.UNLOCKED ===
        Atomics.compareExchange(
            this.sabArr, this.lockIndex, this.UNLOCKED, this.LOCKED);
  }

  /**
   * Blocks execution of the caller while lockIndex remains in the LOCKED
   * state.
   */
  wait() {
    Atomics.wait(this.sabArr, this.lockIndex, this.LOCKED);
  }

  /**
   * Unlock lockIndex, this does not check to see if the lock is currenly held
   * by anyone.
   */
  unlock() {
    Atomics.store(this.sabArr, this.lockIndex, this.UNLOCKED);
    Atomics.notify(this.sabArr, this.lockIndex);
  }

  /**
   * Set the return code for a syscall.
   *
   * @param {number} retcode Must be be able to fit into an Int32, should be one
   *     of the values of ./wasi/errno.js.
   */
  setRetcode(retcode) {
    Atomics.store(this.sabArr, this.retcodeIndex, retcode);
  }

  /**
   * Get the returncode of the last syscall made using this lock.
   *
   * @return {number} A syscall result from ./wasi/errno.js.
   */
  getRetcode() {
    return Atomics.load(this.sabArr, this.retcodeIndex);
  }
}
