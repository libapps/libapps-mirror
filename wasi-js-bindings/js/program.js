// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Programs for encapsulating WASM programs.
 */

/**
 * A program API encapsulating a WASM program.
 */
export class Program {
  /**
   * @constructor
   * @param {string} Path to the WASM program to fetch/load.
   */
  constructor(source) {
    this.source = source;
    this.instance = null;
  }

  /**
   * Instantiate the program (but don't run it).
   *
   * @param {!Object} imports Set of function imports for the WASM program.
   * @return {WebAssembly.Instance} The WASM instance.
   */
  async instantiate(imports) {
    const result = await WebAssembly.instantiateStreaming(
        fetch(this.source), imports,
    );
    this.instance = result.instance;
    return this.instance;
  }

  /**
   * Run the program.
   *
   * This won't normally return until the program itself exits.
   *
   * @return {number} The program exit code.
   */
  run() {
    return this.instance.exports._start();
  }
}
