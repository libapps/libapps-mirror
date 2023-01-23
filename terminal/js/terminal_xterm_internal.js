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
 * @typedef {{
 *            css: {
 *              cell: {
 *                width: number,
 *                height: number,
 *              }
 *            },
 *          }}
 */
export let IRenderDimensions;

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


const A11Y_LIVE_REGION_CSS = `
position: absolute;
width: 0; height: 0;
overflow: hidden;
left: -1000px; top: -1000px;
`;

export class XtermInternal {
  /**
   * @param {!Terminal} terminal
   * @suppress {missingProperties}
   */
  constructor(terminal) {
    this.terminal_ = terminal;
    /** @type {!Array<!HTMLElement>} */
    this.a11yElements_ = [];

    this.core_ = /** @type {{
        _renderService: {
          dimensions: !IRenderDimensions,
          onDimensionsChange: function(function(!IRenderDimensions)),
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
   * Register a callback to be called when the dimensions change. This should
   * only be called after the terminal opened an element.
   *
   * @param {function()} callback
   */
  addDimensionsObserver(callback) {
    this.core_._renderService.onDimensionsChange((d) => callback());
  }

  /**
   * @return {{width: number, height: number}}
   */
  getActualCellDimensions() {
    const dimensions = this.core_._renderService.dimensions;
    return {
      width: dimensions.css.cell.width,
      height: dimensions.css.cell.height,
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
   * sequence is ignored. Note that 1) this actually affects xterm.js globally
   * instead of just the `Terminal` instance; 2) it is idempotent, so it is ok
   * to call it multiple times.
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

  /**
   * @param {!HTMLElement} a11yPageUpButton
   * @param {!HTMLElement} a11yPageDownButton
   */
  enableA11y(a11yPageUpButton, a11yPageDownButton) {
    if (this.terminal_.options.screenReaderMode) {
      throw new Error('screenReaderMode is already true');
    }
    this.terminal_.options.screenReaderMode = true;

    const terminalElement = this.terminal_.element;
    const xtermA11yElement = terminalElement.querySelector(
        '.xterm-accessibility');

    // Surround xtermA11yElement with the buttons.
    xtermA11yElement.insertAdjacentElement('beforebegin', a11yPageUpButton);
    xtermA11yElement.insertAdjacentElement('afterend', a11yPageDownButton);

    // When a screen reader user move the focus (away from the terminal input
    // field), they normally move it upwards because the history output are at
    // the top. So, here we re-position xterm's live region to the bottom so
    // that it will not catch the focus.
    const liveRegionContainer = document.createElement('div');
    liveRegionContainer.style.cssText = A11Y_LIVE_REGION_CSS;
    terminalElement.insertAdjacentElement('beforeend', liveRegionContainer);
    liveRegionContainer.appendChild(
        xtermA11yElement.querySelector('[aria-live]'));

    this.a11yElements_ = [
        a11yPageUpButton,
        a11yPageDownButton,
        liveRegionContainer,
    ];
  }

  disableA11y() {
    if (!this.terminal_.options.screenReaderMode) {
      throw new Error('screenReaderMode is already false');
    }
    this.terminal_.options.screenReaderMode = false;

    for (const element of this.a11yElements_) {
      element.remove();
    }
    this.a11yElements_.length = 0;
  }
}
