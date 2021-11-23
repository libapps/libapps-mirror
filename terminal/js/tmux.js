// Copyright 2021 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Code for tmux integration. The most important classes in this
 * file are `Controller` and `Window`.
 *
 * Note that all the session/window/pane ids here are strings (instead of
 * numbers), and they are prefixed with $/@/% just like how tmux uses them.
 */

/**
 * Enum for the type of layout.
 *
 * @enum {string}
 */
export const LayoutType = {
  LEFT_RIGHT: 'left_right',
  TOP_BOTTOM: 'top_bottom',
};

/**
 * A simple layout contains only one pane, so there is a `paneId` field.
 *
 * @typedef {{
 *            xSize: number,
 *            ySize: number,
 *            xOffset: number,
 *            yOffset: number,
 *            paneId: string,
 *          }}
 */
let SimpleLayout;

/**
 * A complex layout has multiple children.
 *
 * @typedef {{
 *            xSize: number,
 *            ySize: number,
 *            xOffset: number,
 *            yOffset: number,
 *            childrenLayout: !LayoutType,
 *            children: !Array<!Layout>,
 *          }}
 */
let ComplexLayout;

/** @typedef {!SimpleLayout|!ComplexLayout} */
let Layout;

/**
 * This represents a window in tmux. See the doc for `Controller` for more
 * details.
 */
export class Window {
  /**
   * Called when there is a layout update.
   *
   * @param {!Layout} layout
   */
  onLayoutUpdate(layout) { }

  /**
   * Called when the window is closed.
   */
  onClose() { }

  /**
   * Called when a pane belong to this window has output.
   *
   * @param {string} paneId
   * @param {string} data
   */
  onPaneOutput(paneId, data) { }

  /**
   * Called when there is an update for the pane cursor.
   *
   * @param {string} paneId
   * @param {number} x
   * @param {number} y
   */
  onPaneCursorUpdate(paneId, x, y) { }

  /**
   * See `Controller.syncPane()`.
   *
   * @param {string} paneId
   */
  onPaneSyncStart(paneId) { }
}

/**
 * @typedef {{
 *            id: string,
 *            layout: !Layout,
 *            win: !Window,
 *          }}
 */
let WinInfo;

/**
 * @typedef {{
 *            id: string,
 *            winInfo: !WinInfo,
 *          }}
 */
let PaneInfo;

/**
 * @typedef {{id: string, layout: !Layout}}
 */
let WindowData;

/**
 * A Controller object interacts with a tmux process running in control mode.
 * It interprets tmux's output, and also controls tmux by sending commands (e.g.
 * open a new tmux window or resize it).
 *
 * The user of this class is responsible for connecting the controller with the
 * tmux process by:
 *
 * - calling `interpretLine` with every line of output from tmux.
 * - passing an `input` function to the ctor to allow the controller to send
 *   commands to tmux.
 *
 * The controller does not really know what to do with the instructions from the
 * tmux process. Instead, the controller interprets the instructions and
 * translates them to method calls to the relevant `Window` objects.
 *
 * The user is responsible for implementing the actual `Window` class, and
 * passing an openWindow() function to the ctor. The controller will call
 * openWindow() whenever tmux says that there is a new window, and
 * openWindow() should return a `Window` object.
 *
 * The user can (indirectly) control the tmux process by calling `Controller`'s
 * methods such as sendPaneInput().
 *
 * TODO(crbug.com/1252271): maybe put some examples here.
 */
export class Controller {
  /**
   * See the class doc for details about the parameters.
   *
   * @param {{
   *   openWindow: function({
   *     windowId: string,
   *     layout: !Layout,
   *     controller: !Controller}): !Window,
   *   input: function(string),
   * }} param1
   */
  constructor({openWindow, input}) {
    this.openWindow_ = openWindow;
    this.input_ = input;

    this.textEncoder_ = new TextEncoder();

    this.commandQueue_ = [];
    // At the very beginning, tmux always outputs a pair of %begin/%end (just
    // like when a command is sent to tmux). Set a fake command here to consume
    // the pair.
    this.currentCommand_ = new Command(
        () => {
          // TODO(crbug.com/1252271): send ctrl-u to input() to clear input just
          // in case? Or maybe we should require the user to do so.
        },
    );

    /**
     * Handlers for tmux notifications. The handler will receive the content of
     * the notification without the tag (e.g. '%output') or the '/r/n' at the
     * end.
     *
     * @type {!Object<string, function(string)>}
     */
    this.handlers_ = {
      '%output': this.handleOutput_.bind(this),
      '%layout-change': this.handleLayoutChange_.bind(this),
    };

    /**
     * The key is the window id.
     *
     * @type {!Map<string, !WinInfo>}
     */
    this.windows_ = new Map();
    /**
     * The key is the pane id.
     *
     * @type {!Map<string, !PaneInfo>}
     */
    this.panes_ = new Map();
  }

  /**
   * Start the controller. Call it once at the beginning.
   */
  start() {
    this.listWindows((windowDataList) => {
      for (const windowData of windowDataList) {
        this.createWinInfo_(windowData);
      }

      // TODO(crbug.com/1252271): We should start to handle '%window-add',
      // '%window-close' and '%unlink-window-close' here (i.e. add the handlers
      // to `this.handlers_`).
    });
  }

  /**
   * Interpret a single line from the tmux process output. Also see
   * `this.queueCommand()` for the blocking behavior.
   *
   * @param {string} line A line of the output. Should not contain the line
   *                 ending '\r\n'.
   */
  interpretLine(line) {
    // If there is any error, let's log it and continue.
    try {
      this.interpretLine_(line);
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * @param {string} line
   */
  interpretLine_(line) {
    // TODO(crbug.com/1252271): We also need to handle '%exit' and '%error'.

    const tagEnd = line.indexOf(' ');
    const tag = tagEnd >= 0 ? line.slice(0, tagEnd) : null;

    if (tag === '%end') {
      if (!this.currentCommand_?.started) {
        throw new Error(
            'unexpected %end line: no current command or it hasn\'t started');
      }

      this.currentCommand_.finish();
      this.currentCommand_ = null;
      this.maybeRunNextCommand_();
      return;
    }

    if (this.currentCommand_?.started) {
      this.currentCommand_.appendToBuffer(line);
      return;
    }

    if (tag === '%begin') {
      if (!this.currentCommand_) {
        throw new Error('unexpected %begin line: no current command');
      }
      this.currentCommand_.start();
      return;
    }

    // TODO(crbug.com/1252271): handle all necessary notifications:
    // https://github.com/tmux/tmux/wiki/Control-Mode#notifications
    if (tag !== null) {
      const handler = this.handlers_[tag];
      if (handler) {
        handler(line.slice(tagEnd + 1));
      }
    }
  }

  /**
   * Synchronize a pane. When we connect to a tmux process, tmux does not tell
   * us about things such as the current content and cursor position of a pane.
   * Instead, for example, it only sends `%output` notifications for new output.
   * So, we need to do some synchronization first.
   *
   * After calling this function, the corresponding `Window` object will receive
   * a call to `onPaneSyncStart()` first, which indicates that the
   * synchornization just started. Then, the `Window` will receive other calls
   * such as `onPaneOutput()` for the current content of the pane.
   *
   * @param {string} paneId
   */
  syncPane(paneId) {
    const pane = this.panes_.get(paneId);
    if (!pane) {
      throw new Error(`unknown pane: ${paneId}`);
    }
    // TODO(crbug.com/1252271): what if the pane is closed or moved to some
    // other window in the middle?
    this.capturePane(paneId, (output) => {
      pane.winInfo.win.onPaneSyncStart(paneId);
      pane.winInfo.win.onPaneOutput(paneId, output);
    });
    this.getPaneCursor(
        paneId,
        ({x, y}) => pane.winInfo.win.onPaneCursorUpdate(paneId, x, y));
  }

  /**
   * Send input for a pane to the tmux process.
   *
   * @param {string} paneId
   * @param {string} text The pane input.
   */
  sendPaneInput(paneId, text) {
    if (!text) {
      return;
    }
    let command = `send-keys -H -t ${paneId}`;
    for (const x of this.textEncoder_.encode(text)) {
      command += ` ${x.toString(16)}`;
    }
    this.queueCommand(command);
  }

  /**
   * Resize a tmux window.
   *
   * @param {string} winId
   * @param {number} xSize
   * @param {number} ySize
   */
  resizeWindow(winId, xSize, ySize) {
    this.queueCommand(`resize-window -t ${winId} -x ${xSize} -y ${ySize}`);
  }

  /**
   * Get the (cached) layout of a window.
   *
   * @param {string} winId
   * @return {?Layout}
   */
  getLayout(winId) {
    return this.windows_.get(winId)?.layout;
  }

  /**
   * List windows and pass the result to `callback`.
   *
   * @param {function(!Array<!WindowData>)} callback
   */
  listWindows(callback) {
    this.queueCommand('list-windows -F "#{window_id} #{window_layout}"',
        (output) => {
          const windows = [];
          for (const line of output) {
            const match = line.match(/^(@\d+) \w+,(.*)$/);
            windows.push({
              id: match[1],
              layout: parseWindowLayout(match[2]),
            });
          }
          callback(windows);
        });
  }

  /**
   * Capture a pane and pass the result to `callback`.
   *
   * @param {string} paneId
   * @param {function(string)} callback
   */
  capturePane(paneId, callback) {
    // TODO(crbug.com/1252271): The output of this can contains strings started
    // with '%end'/..., and this might break `interpertLine()`. We need to find
    // a way to deal with this.
    //
    // TODO(crbug.com/1252271): We might want to follow what iterm2 does:
    // https://github.com/gnachman/iTerm2/blob/034160e3c67edb2a3c06821e0e022efcdde72daf/sources/TmuxWindowOpener.m#L189
    this.queueCommand(`capture-pane -peNJt ${paneId}`, (output) => {
      callback(output.join('\r\n'));
    });
  }

  /**
   * Get a pane's cursor and pass the result to `callback`.
   *
   * @param {string} paneId
   * @param {function({x: number, y: number})} callback
   */
  getPaneCursor(paneId, callback) {
    this.queueCommand(`list-panes -t ${paneId} -F '#{cursor_x} #{cursor_y}'`,
        (output) => {
          const match = output[0].match(/^(\d+) (\d+)$/);
          callback({x: Number(match[1]), y: Number(match[2])});
        });
  }

  /**
   * Send an detach command to tmux.
   */
  detach() {
    this.queueCommand('detach');
  }

  /**
   * Put a tmux command in the command queue. The controller calls `callback`
   * with the result when it is ready.
   *
   * Note that by design, when the result is ready (i.e. when tmux outputs the
   * corresponding '%end' notification), `this.interpretLine()` will block until
   * the callback returns. This is to avoid race conditions. It is also the
   * reason why we use a callback here instead of making the function async.
   * Callers who don't care about this can make the callback function async.
   *
   * @param {string} command
   * @param {function(!Array<string>)=} callback The argument is an array of
   *     lines. The lines do not contain the ending '\r\n'
   */
  queueCommand(command, callback = () => {}) {
    this.commandQueue_.push([command, new Command(callback)]);
    this.maybeRunNextCommand_();
  }

  maybeRunNextCommand_() {
    if (this.currentCommand_) {
      return;
    }
    if (this.commandQueue_.length) {
      let commandStr;
      [commandStr, this.currentCommand_] = this.commandQueue_.shift();
      this.input_(commandStr + '\r');
    }
  }

  /**
   * @param {!WindowData} windowData
   */
  createWinInfo_(windowData) {
    if (this.windows_.has(windowData.id)) {
      throw new Error(`duplicate winId=${windowData.id}`);
    }
    const winInfo = {
      id: windowData.id,
      layout: windowData.layout,
      win: this.openWindow_({
        windowId: windowData.id,
        layout: windowData.layout,
        controller: this,
      }),
    };
    for (const paneId of iterPaneIds(winInfo.layout)) {
      if (this.panes_.has(paneId)) {
        throw new Error(`duplicate paneId=${paneId}`);
      }
      this.panes_.set(paneId, {id: paneId, winInfo});
    }

    this.windows_.set(winInfo.id, winInfo);
  }

  /**
   * Handler for '%layout-change window-id window-layout window-visible-layout
   * window-flags'
   *
   * @param {string} text
   */
  handleLayoutChange_(text) {
    // TODO(crbug.com/1252271): we should also update this.windows_ and
    // this.panes_ here.

    const match = text.match(/^(@\d+) \w+,(\S+) \w+,(\S+) .*/);
    if (!match) {
      throw new Error(`failed to parse layout: ${text}`);
    }
    const winId = match[1];
    const winInfo = this.windows_.get(match[1]);
    if (!winInfo) {
      console.warn(`ignore unknown window id ${winId}`);
      return;
    }
    // TODO(crbug.com/1252271): This is using the "window-layout", but should I
    // use the "window-visible-layout" instead?
    const layout = parseWindowLayout(match[2]);
    winInfo.win.onLayoutUpdate(layout);
  }

  /**
   * Handler for '%output pane-id value'
   *
   * @param {string} text
   */
  handleOutput_(text) {
    const match = text.match(/^(%\d+) (.*)$/);
    if (!match) {
      throw new Error(`failed to parse output: ${text}`);
    }

    const paneId = match[1];
    const pane = this.panes_.get(paneId);
    if (!pane) {
      console.warn(`unknown pane id: ${paneId}`);
      return;
    }
    // Unescape characters that was converted to the octal form.
    const data = match[2].replace(
        /\\[01][0-7]{2}/g,
        (x) => String.fromCharCode(parseInt(x.slice(1), 8)));
    pane.winInfo.win.onPaneOutput(paneId, data);
  }
}


/* eslint-disable-next-line jsdoc/require-returns-check */
/**
 * A generator to iterate over all pane ids in a layout.
 *
 * @param {!Layout} layout
 * @return {!Generator<string>}
 */
export function* iterPaneIds(layout) {
  if (layout.children) {
    for (const child of layout.children) {
      yield* iterPaneIds(child);
    }
    return;
  }

  yield /** @type {string} */(layout.paneId);
}

/**
 * Parse window layout from a string (e.g.
 * '126x79,0,0{63x79,0,0,2,62x79,64,0,3}'). The string should not contain the
 * checksum prefix. See `layout_dump()` in
 * https://github.com/tmux/tmux/blob/6c2bf0e22119804022c8038563b9865999f5a026/layout-custom.c
 * for more details.
 *
 * @param {string} layoutStr
 * @return {!Layout}
 */
export function parseWindowLayout(layoutStr) {
  // Parse exactly one layout (either `SimpleLayout` or `ComplexLayout`) from
  // `layoutStr` starting at index `cursor`. Return the layout and a new cursor.
  function parse(cursor) {
    function throwParseError(msg = '') {
      throw new Error(
          `failed to parse '${layoutStr}' at index ${cursor}: ${msg}`);
    }

    // Get the size and offset. This is the same for simple layouts and complex
    // layouts.
    const match = layoutStr.slice(cursor).match(/^(\d+)x(\d+),(\d+),(\d+)/);
    if (!match) {
      throwParseError('expecting size and offset');
    }
    const current = {
      xSize: Number(match[1]),
      ySize: Number(match[2]),
      xOffset: Number(match[3]),
      yOffset: Number(match[4]),
    };
    cursor += match[0].length;
    let childrenLayout = LayoutType.TOP_BOTTOM;
    let closeBracket = ']';
    switch (layoutStr[cursor]) {
      case ',': {
        // Simple layout, expecting pane id.
        ++cursor;
        const match = layoutStr.slice(cursor).match(/^\d+/);
        if (!match) {
          throwParseError('expecting pane id');
        }
        current.paneId = `%${match[0]}`;
        cursor += match[0].length;
        break;
      }
      case '{':
        childrenLayout = LayoutType.LEFT_RIGHT;
        closeBracket = '}';
        // Fall through
      case '[': {
        current.childrenLayout = childrenLayout;
        const children = current.children = [];
        ++cursor;
        // Each loop parse exactly one child.
        while (true) {
          [children[children.length], cursor] = parse(cursor);
          const lastChar = layoutStr[cursor++];
          if (lastChar === closeBracket) {
            // All children has been parsed.
            if (children.length < 2) {
              throwParseError(`expecting more than 1 child`);
            }
            break;
          } else if (lastChar !== ',') {
            throwParseError(`expecting ',', got ${lastChar}`);
          }
          // More children following. Continue the loop.
        }
        break;
      }
      default:
        throwParseError(`expecting any of ',[{', got ${layoutStr[cursor]}`);
    }

    return [current, cursor];
  }

  const [layout, finalIndex] = parse(0);
  if (finalIndex != layoutStr.length) {
    throw new Error(
        `excessive strings after index ${finalIndex} in ${layoutStr}`);
  }
  return layout;
}

class Command {
  /**
   * @param {function(!Array<string>)} callback The callback to invoke when the
   * command finishes.
   */
  constructor(callback) {
    this.buffer_ = null;
    this.callback_ = callback;
  }

  /**
   * Called when we receive the corresponding `%begin` notification.
   */
  start() {
    if (this.buffer_) {
      throw new Error('command has already started');
    }
    this.buffer_ = [];
  }

  /**
   * Append a line of command output.
   *
   * @param {string} line
   */
  appendToBuffer(line) {
    this.buffer_.push(line);
  }

  /**
   * @return {boolean} Return whether `start()` has been called.
   */
  get started() {
    return !!this.buffer_;
  }

  /**
   * Finish the command by calling the callback synchronously. This should be
   * called when we received the corresponding `%end` notification.
   */
  finish() {
    this.callback_(/** @type {!Array<string>} */(this.buffer_));
    this.buffer_ = null;
    this.callback_ = null;
  }
}

