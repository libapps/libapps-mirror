// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Implements XtermInternal, which interacts with the internal of
 * xterm.js to provide extra functionalities. Unlike the public APIs, the
 * internal of xterm.js is not stable, so we should try to minimize this file
 * and have good test coverage.
 */

import {delayedScheduler} from './terminal_common.js';
import {Terminal} from './xterm.js';

const BUFFER_SIZE = 4096;

/**
 * @typedef {{
 *     params: !Int32Array,
 *     length: number,
 * }}
 */
let IParams;

/**
 * A handler for tmux's DCS P sequence.
 *
 * Also see IDcsHandler at
 * https://github.com/xtermjs/xterm.js/blob/2659de229173acf883f58401257d64aecc4138e1/src/common/parser/Types.d.ts#L79
 */
class TmuxDcsPHandler {
  /**
   * @param {function(?string)} onTmuxControlModeLine See
   *     `hterm.Terminal.onTmuxControlModeLine`.
   */
  constructor(onTmuxControlModeLine) {
    this.onTmuxControlModeLine_ = onTmuxControlModeLine;
    /**
     * The buffer to hold an incomplete tmux line. It is set to null if tmux
     * control mode is not active.
     *
     * @type {?string}
     */
    this.buffer_ = null;
  }

  /** @param {!IParams} params */
  hook(params) {
    if (params.length === 1 && params.params[0] === 1000) {
      this.buffer_ = '';
      return;
    }
    console.warn('Unknown DCS P sequence. Params:',
        params.params.slice(0, params.length));
  }

  /**
   * @param {!Uint32Array} data
   * @param {number} start
   * @param {number} end
   */
  put(data, start, end) {
    data = data.subarray(start, end);
    if (this.buffer_ === null) {
      return;
    }

    for (const code of data) {
      const c = String.fromCodePoint(code);
      if (c === '\n' && this.buffer_.slice(-1) === '\r') {
        this.onTmuxControlModeLine_(this.buffer_.slice(0, -1));
        this.buffer_ = '';
        continue;
      }
      this.buffer_ += String.fromCodePoint(code);
    }
  }

  /** @param {boolean} success */
  unhook(success) {
    if (this.buffer_ !== null) {
      if (this.buffer_) {
        console.warn('Unexpected tmux data before ST', {data: this.buffer_});
      }
      this.onTmuxControlModeLine_(null);
    }
    this.buffer_ = null;
  }
}


export class XtermInternal {
  /**
   * @param {!Terminal} terminal
   * @suppress {missingProperties}
   */
  constructor(terminal) {
    this.terminal_ = terminal;

    this.core_ = /** @type {{
        _renderService: {
          dimensions: {
            actualCellHeight: number,
            actualCellWidth: number,
          },
        },
        _inputHandler: {
          nextLine: function(),
          print: function(!Uint32Array, number, number),
          _moveCursor: function(number, number),
          _parser: {
            registerDcsHandler: function(!Object, !TmuxDcsPHandler),
            _transitions: {
              add: function(number, number, number, number),
            },
          }
        },
    }} */(this.terminal_._core);

    this.encodeBuffer_ = new Uint32Array(BUFFER_SIZE);
    this.scheduleFullRefresh_ = delayedScheduler(
        () => this.terminal_.refresh(0, this.terminal_.rows), 10);
  }

  /**
   * @return {{width: number, height: number}}
   */
  getActualCellDimensions() {
    const dimensions = this.core_._renderService.dimensions;
    return {
      width: dimensions.actualCellWidth,
      height: dimensions.actualCellHeight,
    };
  }

  /**
   * See hterm.Terminal.print.
   *
   * @param {string} str
   */
  print(str) {
    let bufferLength = 0;
    for (const c of str) {
      this.encodeBuffer_[bufferLength++] = c.codePointAt(0);
      if (bufferLength === BUFFER_SIZE) {
        // The buffer is full. Let's send the data now.
        this.core_._inputHandler.print(this.encodeBuffer_, 0, bufferLength);
        bufferLength = 0;
      }
    }
    this.core_._inputHandler.print(this.encodeBuffer_, 0, bufferLength);
    this.scheduleFullRefresh_();
  }

  newLine() {
    this.core_._inputHandler.nextLine();
  }

  /**
   * @param {number} number
   */
  cursorLeft(number) {
    this.core_._inputHandler._moveCursor(-number, 0);
    this.scheduleFullRefresh_();
  }

  /**
   * Install a ESC k (set window name) handler for tmux. The data in the
   * sequence is ignored.
   */
  installEscKHandler() {
    this.core_._inputHandler._parser._transitions.add(
        // k
        0x6b,
        // ParserState.ESCAPE,
        1,
        // ParserAction.IGNORE
        0,
        // ParserState.DCS_IGNORE
        11,
    );
  }

  /**
   * @param {function(?string)} onTmuxControlModeLine See
   *     `hterm.Terminal.onTmuxControlModeLine`.
   */
  installTmuxControlModeHandler(onTmuxControlModeLine) {
    this.core_._inputHandler._parser.registerDcsHandler({final: 'p'},
        new TmuxDcsPHandler(onTmuxControlModeLine));
  }
}
