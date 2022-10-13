// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Externs definitions for xterm.js used in terminal.
 *
 * TODO(lxj): xterm actually provides typing information (in
 * `node_modules/xterm/typing/xterm.d.ts`). Maybe we should find some way to use
 * that.
 *
 * @externs
 */

class IDisposable {
  dispose() {}
}

class IParser {
  /**
   * @param {number} ident
   * @param {function(string): boolean|!Promise<boolean>} callback
   */
  registerOscHandler(ident, callback) {}
}

class IBufferLine {
  /**
   * @param {boolean=} trimRight
   * @param {number=} startColumn
   * @param {number=} endColumn
   * @return {string}
   */
  translateToString(trimRight, startColumn, endColumn) {}
}

class IBuffer {
  constructor() {
    this.cursorY = 0;
    this.cursorX = 0;
  }

  /**
   * @param {number} y
   * @return {!IBufferLine | undefined}
   */
  getLine(y) {}
}

class IBufferNamespace {
  constructor() {
    /** @type {!IBuffer} */
    this.active;
    /** @type {!IBuffer} */
    this.normal;
    /** @type {!IBuffer} */
    this.alternate;
  }
}

class Terminal$$module$js$xterm {
  /**
   * @param {!Object=} options
   */
  constructor(options) {
    /** @type {!IBufferNamespace} */
    this.buffer;
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
    this.modes = {mouseTrackingMode: ''};
  }

  /**
   * @param {function(!KeyboardEvent): boolean} handler
   */
  attachCustomKeyEventHandler(handler) {}

  clear() {}

  dispose() {}

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
   * @param {function()} callback
   * @return {!IDisposable}
   */
  onBell(callback) {}

  /**
   * @param {function(string)} callback
   * @return {!IDisposable}
   */
  onBinary(callback) {}

  /**
   * @param {function(string)} callback
   * @return {!IDisposable}
   */
  onData(callback) {}

  /**
   * @param {function({cols: number, rows: number})} callback
   * @return {!IDisposable}
   */
  onResize(callback) {}

  /**
   * @param {function()} callback
   * @return {!IDisposable}
   */
  onSelectionChange(callback) {}

  /**
   * @param {function(string)} callback
   * @return {!IDisposable}
   */
  onTitleChange(callback) {}

  /**
   * @param {function()} callback
   * @return {!IDisposable}
   */
  onWriteParsed(callback) {}

  /**
   * @param {!Element} elem
   */
  open(elem) {}

  /**
   * @param {!string} data
   */
  paste(data) {}

  /**
   * @param {number} start
   * @param {number} end
   */
  refresh(start, end) {}

  reset() {}

  /**
   * @param {number} cols
   * @param {number} rows
   */
  resize(cols, rows) {}

  /**
   * @param {number} number
   */
  scrollPages(number) {}

  scrollToBottom() {}

  /**
   * @param {string|!Uint8Array} data
   * @param {function()=} callback Optional callback that fires when the data
   *     was processed by the parser.
   */
  write(data, callback) {}

  /**
   * @param {string|!Uint8Array} data
   * @param {function()=} callback Optional callback that fires when the data
   *     was processed by the parser.
   */
  writeln(data, callback) {}
}

class WebglAddon$$module$js$xterm {}
