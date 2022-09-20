// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Externs definitions for xterm.js used in terminal.
 *
 * @externs
 */

class IParser {
  /**
   * @param {number} ident
   * @param {function(string): boolean|!Promise<boolean>} callback
   */
  registerOscHandler(ident, callback) {}
}

class Terminal$$module$js$xterm {
  /**
   * @param {!Object=} options
   */
  constructor(options) {
    /** @type {?HTMLElement} */
    this.element;
    /** @type {!Object} */
    this.options;
    /** @type {number} */
    this.cols;
    /** @type {number} */
    this.rows;
    /** @type {IParser} */
    this.parser;
    this.unicode = {
      activeVersion: '',
    };
    this._core = {
      _renderService: {
        dimensions: {
          actualCellWidth: 0,
          actualCellHeight: 0,
        },
      },
    };
  }

  /**
   * @param {function(!KeyboardEvent): boolean} handler
   */
  attachCustomKeyEventHandler(handler) {}

  focus() {}

  /** @return {string} */
  getSelection() {}

  /** @return {boolean} */
  hasSelection() {}

  /**
   * @param {!WebglAddon$$module$js$xterm} addon
   */
  loadAddon(addon) {}

  /**
   * @param {function(string)} callback
   */
  onBinary(callback) {}

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
   * @param {number} cols
   * @param {number} rows
   */
  resize(cols, rows) {}

  /**
   * @param {string|!Uint8Array} data
   */
  write(data) {}

  /**
   * @param {string|!Uint8Array} data
   */
  writeln(data) {}
}

class WebglAddon$$module$js$xterm {}
