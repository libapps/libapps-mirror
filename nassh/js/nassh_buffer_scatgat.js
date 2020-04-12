// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Scatter/gather buffer implementation.
 */

/**
 * A buffer using the scatter/gather pattern.
 *
 * Buffers written will be retained in their entirety, and we'll take care of
 * walking them when reading as if it were one giant linear buffer.  This way
 * we avoid creating new temporary buffers on the fly, and unnecessary memcpys.
 */
nassh.buffer.ScatGat = class extends nassh.buffer.Interface {
  /** @inheritDoc */
  constructor(autoack = false) {
    super(autoack);

    /**
     * The list of queued buffers (unread/unacked).
     *
     * We use an object rather than an array as it simplifies implementation:
     * we can freely delete elements when finished without having to reshift or
     * reallocate the storage on the fly.
     *
     * @type {!Object<number, !Uint8Array>}
     */
    this.queue_ = {};

    /**
     * The next free position for queueing a buffer written to us.
     *
     * @type {number}
     */
    this.writePos_ = 0;

    /**
     * The current buffer we're reading.
     *
     * @type {number}
     */
    this.readPos_ = 0;

    /**
     * Read offset into the current buffer.
     *
     * @type {number}
     */
    this.readOffset_ = 0;

    /**
     * The buffer that has yet to be acked fully.
     *
     * @type {number}
     */
    this.ackPos_ = 0;

    /**
     * Ack offset into the current buffer.
     *
     * @type {number}
     */
    this.ackOffset_ = 0;
  }

  /** @inheritDoc */
  write(buffer) {
    const u8 = new Uint8Array(buffer);
    // Since writePos_ is a number, this is limited to 2^53 which is ~9 peta
    // buffers (not bytes).  By the time this hits the limit, we'd have to
    // transfer ~1EB in a single direction which is unrealistic atm.  If we
    // find a situation where this matters, we can switch writePos to a bigint.
    this.queue_[this.writePos_++] = u8;
    this.unreadCount_ += u8.length;
  }

  /** @inheritDoc */
  read(length) {
    let written = 0;
    // We allocate the max requested size initially, but we'll shrink it down
    // just before returning in case we weren't able to fill the request.
    const ret = new Uint8Array(length);

    // Walk each unread buffer and copy over data.
    while (written < length && this.readPos_ in this.queue_) {
      // Create a view into the return to make it easier to memcpy below.
      const output = ret.subarray(written);
      // Pull out the current unread buffer (and the offset into it).
      const curr = this.queue_[this.readPos_];
      const input = curr.subarray(
          this.readOffset_, this.readOffset_ + output.length);
      // Copy out this chunk of data.
      output.set(input);
      written += input.length;

      // Figure out if we've fully consumed this buffer yet.
      if (input.length + this.readOffset_ === curr.length) {
        ++this.readPos_;
        this.readOffset_ = 0;
      } else {
        this.readOffset_ += input.length;
      }
    }

    // If auto-acking, delete any fully read buffers now before syncing the
    // ack state to the current read state.
    if (this.autoack_) {
      while (this.ackPos_ < this.readPos_) {
        delete this.queue_[this.ackPos_++];
      }
      this.ackOffset_ = this.readOffset_;
    }

    this.unreadCount_ -= written;
    // Shrink the returned view to match how much data actually exists.
    return ret.subarray(0, written);
  }

  /** @inheritDoc */
  ack(length) {
    let acked = 0;
    while (acked < length) {
      // Look up the current unacked buffer (if any).
      const curr = this.queue_[this.ackPos_];
      if (!curr) {
        break;
      }

      // Figure out if we can ack the entire buffer, or just part of it.
      const togo = length - acked;
      if (curr.length - this.ackOffset_ <= togo) {
        // We're acking this entire buffer, so free it before moving on.
        acked += curr.length - this.ackOffset_;
        delete this.queue_[this.ackPos_++];
        this.ackOffset_ = 0;
      } else {
        // We aren't acking the entire buffer, so update the offset into it.
        acked += togo;
        this.ackOffset_ += togo;
      }
    }
  }
};
