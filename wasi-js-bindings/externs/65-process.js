// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Extern settings for the Process API.
 */

/**
 */
class Process {
  /**
   * @param {{
   *   executable: string,
   *   argv: !Array<string>,
   *   environ: !Object<string, string>,
   * }} param1
   */
  constructor({executable, argv, environ}) {
    /** @type {string} */
    this.executable = '';
    /** @type {!Array<string>} */
    this.argv = [];
    /** @type {!Object<string, string>} */
    this.environ = {};
  }

  /** @param {*} args */
  debug(...args) {}

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
}
