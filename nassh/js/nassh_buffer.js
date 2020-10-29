// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Core buffer related logic.
 */

nassh.buffer = {};

/**
 * Interface that all nassh.buffer APIs must implement.
 *
 * @abstract
 */
nassh.buffer.Interface = class {
  /**
   * @param {boolean=} autoack Automatically call ack() during read().
   */
  constructor(autoack = false) {
    /** @type {boolean} Whether to automatically ack bytes once read. */
    this.autoack_ = autoack;

    /** @type {number} How many unread bytes are in the buffer. */
    this.unreadCount_ = 0;
  }

  /**
   * Determines whether the unread buffer is empty.
   *
   * This is not how many bytes have yet to be acked.
   *
   * @return {boolean} Whether any data is available for reading.
   */
  isEmpty() {
    return this.unreadCount_ === 0;
  }

  /**
   * Returns how many bytes are in the buffer but not yet read.
   *
   * @return {number} How many bytes are available for reading.
   */
  getUnreadCount() {
    return this.unreadCount_;
  }

  /**
   * Add the buffer to the queue.
   *
   * The buffer may be a raw ArrayBuffer or a typed array.  The data is copied
   * in, so the buffer may be safely reused after it's been written.
   *
   * @abstract
   * @param {!ArrayBuffer|!TypedArray} buffer The buffer to queue.
   */
  write(buffer) {}

  /**
   * Reads queued data out.
   *
   * The returned array is a view into the underlying buffer.  It should not be
   * modified.
   *
   * Short/partial reads are supported.
   *
   * @abstract
   * @param {number} length Maximum number of bytes to read.
   * @return {!Uint8Array} The bytes requested.
   */
  read(length) {}

  /**
   * Acks bytes previously read from the buffer.
   *
   * Data is not actually released until acked.
   *
   * @abstract
   * @param {number} length How many bytes to ack.
   */
  ack(length) {}

  /** @override */
  toString() {
    return `[nassh.buffer: ${this.getUnreadCount()} unread]`;
  }
};

/**
 * The buffer backend to use.
 */
nassh.buffer.backend = 'concat';

/**
 * Allocates a new buffer and returns it.
 *
 * This respects the dynamic backend selection.
 *
 * @param {*} args
 * @return {!nassh.buffer.Interface}
 */
nassh.buffer.new = function(...args) {
  switch (nassh.buffer.backend) {
    case 'scatgat':
      return new nassh.buffer.ScatGat(...args);

    default:
      console.warn(`Unknown buffer type '${nassh.buffer.backend}'; ` +
                   `using 'concat' instead.`);
    case 'concat':
      return new nassh.buffer.Concat(...args);
  }
};
