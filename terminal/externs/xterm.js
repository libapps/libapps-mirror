// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Externs definitions for xterm.js used in terminal.
 *
 * @externs
 */

class Terminal$$module$js$xterm {
  constructor() {
    /** @type {!Object} */
    this.options;
    /** @type {number} */
    this.cols;
    /** @type {number} */
    this.rows;
  }

  focus() {}

  /** @return {string} */
  getSelection() {}

  /**
   * @param {!FitAddon$$module$js$xterm|!WebglAddon$$module$js$xterm} addon
   */
  loadAddon(addon) {}

  /**
   * @param {function(string)} callback
   */
  onData(callback) {}

  /**
   * @param {function({cols: number, rows: number})} callback
   */
  onResize(callback) {}

  /**
   * @param {function()} callback
   */
  onSelectionChange(callback) {}

  /**
   * @param {function(string)} callback
   */
  onTitleChange(callback) {}

  /**
   * @param {!Element} elem
   */
  open(elem) {}

  reset() {}

  /**
   * @param {string|!Uint8Array} data
   */
  write(data) {}

  /**
   * @param {string|!Uint8Array} data
   */
  writeln(data) {}
}

class FitAddon$$module$js$xterm {
  fit() {}
}

class WebglAddon$$module$js$xterm {}
