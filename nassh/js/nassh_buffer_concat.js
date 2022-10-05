// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Basic buffer that concats inputs together.
 */

import {concatTyped} from './lib_array.js';
import {BufferInterface} from './nassh_buffer_interface.js';

/**
 * A very simple buffer that concats inputs together.
 */
export class ConcatBuffer extends BufferInterface {
  /** @inheritDoc */
  constructor(autoack = false) {
    super(autoack);
    this.buffer_ = new Uint8Array(0);
    this.readPos_ = 0;
  }

  /** @inheritDoc */
  write(buffer) {
    const u8 = new Uint8Array(buffer);
    this.buffer_ = concatTyped(this.buffer_, u8);
    this.unreadCount_ += u8.length;
  }

  /** @inheritDoc */
  read(length) {
    const ret = this.buffer_.subarray(this.readPos_, this.readPos_ + length);
    this.readPos_ += ret.length;
    if (this.autoack_) {
      this.ack(ret.length);
    }
    this.unreadCount_ -= ret.length;
    return ret;
  }

  /** @inheritDoc */
  ack(length) {
    this.buffer_ = this.buffer_.subarray(length);
    this.readPos_ -= length;
  }
}
