// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Programs for encapsulating WASM programs.
 */

import * as util from './util.js';

/**
 * A program API encapsulating a WASM program.
 */
export class Program {
  /**
   * @param {string|!Promise<!Response>|!Response|!ArrayBuffer} source The WASM
   *     program to run.  Strings will automatically be fetched, responses will
   *     be processed, and ArrayBuffers used directly.
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

    let stream = this.stream_;
    if (this.source instanceof ArrayBuffer) {
      stream = false;
    }

    let source;
    if (typeof this.source === 'string') {
      source = fetch(this.source);
    } else {
      source = this.source;
    }

    if (stream) {
      if (source instanceof ArrayBuffer) {
        throw new util.ApiViolation(
            'source cannot be an ArrayBuffer when streaming');
      }
      /** @suppress {checkTypes} Closure externs are missing Response. */
      result = await WebAssembly.instantiateStreaming(source, imports);
    } else {
      let buffer;
      if (this.source instanceof ArrayBuffer) {
        buffer = this.source;
      } else {
        if (source instanceof Promise) {
          source = await source;
        }
        buffer = await source.arrayBuffer();
      }

      result = await WebAssembly.instantiate(buffer, imports);
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
    // WASI libc will return here only if the program *returns* 0 from its main
    // function.  If it *returns* non-zero, WASI libc will call exit() with that
    // value which triggers the exit syscall, and this point never returns.  If
    // the program calls exit() itself, then it too runs the exit syscall.  If
    // the program aborts, WASM will throw an exception which our Program class
    // will catch & process.  This seems more complicated than it should be.
    return this.instance.exports['_start']() ?? 0;
  }
}
