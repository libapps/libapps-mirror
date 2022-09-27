// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Extern settings for the Process API.
 * @externs
 */

/**
 */
class Process {
  /**
   * @param {{
   *   executable: (string|!Promise<!Response>|!Response|!ArrayBuffer),
   *   argv: (!Array<string>|undefined),
   *   environ: (!Object<string, string>|undefined),
   * }} param1
   */
  constructor({executable, argv, environ}) {
    /** @type {(string|!Promise<!Response>|!Response|!ArrayBuffer)} */
    this.executable = '';
    /** @type {!Array<string>} */
    this.argv = [];
    /** @type {!Object<string, string>} */
    this.environ = {};
    /** @type {?WebAssembly.Instance} */
    this.instance_ = null;
  }

  /** @param {*} args */
  debug(...args) {}

  /** @param {*} args */
  logGroup(...args) {}

  /** @param {*} args */
  logError(...args) {}

  /**
   * Get a u8 view into the WASM memory.
   *
   * @param {number} base Starting offset in WASM memory to access.
   * @param {number=} end End offset in WASM memory.
   * @return {!Uint8Array}
   */
  getMem(base, end = undefined) {}

  /**
   * @param {number} base Starting offset in WASM memory to access.
   * @param {number=} length Length of view in WASM memory.
   * @return {!WasiView}
   */
  getView(base, length = undefined) {}

  /**
   * Mark the program as exited.
   *
   * This is largely a callback from the respective syscall.
   *
   * @param {number} status The program's exit code.  This is not the same thing
   *     as process exit status (which is a bit field of exit/signal/etc...).
   */
  exit(status) {}

  /**
   * Mark the program as aborted.
   *
   * This is when the program exits abnormally, either through an abort() call,
   * or via __builtin_trap(), or other "unreachable" code point.
   */
  abort() {}
}
