// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Process with signal support.
 * @suppress {moduleLoad}
 * @suppress {checkTypes} module$__$wasi_js_bindings$js naming confusion.
 */

import {Process} from '../../wasi-js-bindings/index.js';

/**
 * Background process w/wassh extensions.
 *
 * We aren't customizing it currently, but we might in the future, so provide a
 * name now to avoid rewriting symbols in the future.
 */
export class Foreground extends Process.Foreground {}

/**
 * Background process w/wassh extensions.
 */
export class Background extends Process.Background {
  constructor(...args) {
    super(...args);

    /** @const {!Array<number>} */
    this.signal_queue = [];
  }

  /**
   * Send (queue) a signal for the process.
   *
   * @param {number} signum The signal to send.  This uses musl ABI for signal
   *     numbers, not WASI ABI.
   */
  send_signal(signum) {
    this.signal_queue.push(signum);
    if (this.handler.notify_) {
      this.handler.notify_();
    }
  }

  /**
   * Write data to the plugin.
   *
   * @param {number} fd The file handle to write to.
   * @param {!ArrayBuffer} buf The content to write.
   * @return {!WASI_t.errno|{nwritten: !WASI_t.size}}
   */
  async writeTo(fd, buf) {
    return this.handler.handle_fd_write(fd, buf);
  }
}
