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
   * @param {string} source Path to the WASM program to fetch/load.
   * @param {boolean=} stream Whether to use WebAssembly.instantiateStreaming.
   */
  constructor(source, stream = false) {
    this.source = source;
    /** @type {?WebAssembly.Instance} */
    this.instance = null;
    // Hack for webservers that don't return .wasm with right mime type.
    // https://www.w3.org/TR/wasm-web-api-1/#streaming-modules
    // https://github.com/http-party/http-server/issues/35#issuecomment-455666015
    this.stream_ = stream;
  }

  /**
   * Instantiate the program (but don't run it).
   *
   * @param {!Object} imports Set of function imports for the WASM program.
   * @return {!Promise<!WebAssembly.Instance>} The WASM instance.
   */
  async instantiate(imports) {
    let result;
    if (this.stream_) {
      result = await WebAssembly.instantiateStreaming(
        fetch(this.source), imports,
      );
    } else {
      result = await fetch(this.source)
        .then((response) => response.arrayBuffer())
        .then((bytes) => WebAssembly.instantiate(bytes, imports));
    }
    this.instance = result.instance;
    return /** @type {!WebAssembly.Instance} */ (this.instance);
  }

  /**
   * Run the program.
   *
   * This won't normally return until the program itself exits.
   *
   * @return {number} The program exit code.
   */
  run() {
    return this.instance.exports['_start']();
  }
}
