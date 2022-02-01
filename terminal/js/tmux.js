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
export let SimpleLayout;

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
export let ComplexLayout;

/** @typedef {!SimpleLayout|!ComplexLayout} */
export let Layout;

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
   * Called when the window should be closed. This also happens when the tmux
   * process is exiting. After this is called, the controller will not interact
   * with this instance any more.
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
 * @typedef {{major: number, minor: string}}
 */
let TmuxVersion;

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
 *
 * TODO(crbug.com/1252271): If something breaks (e.g. exceptions), we should try
 * to exit nicely (e.g. detach the tmux session, and inform the user somehow.)
 */
export class Controller {
  /**
   * onStart(errorLines) is called when the controller finished initialization.
   * If everything is fine, `errorLines` will be null; otherwise, it will
   * contain the error messages. The user should only call interpretLine() but
   * not the other methods before onStart() is called.
   *
   * See the class doc for details about the other parameters.
   *
   * @param {{
   *   openWindow: function({
   *     windowId: string,
   *     layout: !Layout,
   *     controller: !Controller}): !Window,
   *   input: function(string),
   *   onStart: function(?Array<string>),
   * }} param1
   */
  constructor({openWindow, input, onStart}) {
    this.openWindow_ = openWindow;
    this.input_ = input;
    this.onStart_ = onStart;

    this.waitExit_ = false;
    this.closed_ = false;
    this.textEncoder_ = new TextEncoder();

    /**
     * Commands that haven't been sent to `this.input_`.
     *
     * @type {!Array<!Command>}
     */
    this.pendingCommands_ = [];
    this.sendPendingCommands_ = this.sendPendingCommands_.bind(this);
    this.sendPendingCommandsScheduled_ = false;

    /**
     * This stores commands that have been sent to `this.input_` and are waiting
     * for the results.
     *
     * @type {!Array<!Command>}
     */
    this.commands_ = [
        // At the very beginning, tmux prints either a pair of %begin/%end or
        // %begin/%error (just like when a command is sent to tmux). Put a fake
        // command here to process it.
        new Command(
            '',
            (lines) => {
              // TODO(crbug.com/1252271): send ctrl-u to input() to clear input
              // just in case? Or maybe we should require the user to do so.
              if (lines.length) {
                console.warn('unexpected lines when tmux is starting: ', lines);
              }
              this.init_();
            },
            (lines) => {
              this.onStart_(lines);
            },
        ),
    ];

    /**
     * Handlers for tmux notifications. The handler will receive the content of
     * the notification without the tag (e.g. '%output') or the '/r/n' at the
     * end.
     *
     * @type {!Object<string, function(string)>}
     */
    this.handlers_ = {
      '%exit': this.handleExit_.bind(this),
      '%layout-change': this.handleLayoutChange_.bind(this),
      '%output': this.handleOutput_.bind(this),
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

    /** @private {?TmuxVersion} */
    this.tmuxVersion_ = null;
  }

  /**
   * Init the controller. Call it once at the beginning.
   */
  init_() {
    // Query the tmux process version.
    this.queueCommand('display-message -p "#{version}"', (lines) => {
      try {
        // A version number looks like this: '3.2a'. The number part is the
        // `major` and whatever follows will be `minor`. This also works for say
        // '3', '3.0' and '3a'.
        const match = lines[0].match(/^([0-9]+(?:.[0-9]+)?)(.*)$/);
        this.tmuxVersion_ = {
          major: Number.parseFloat(match[1]),
          minor: match[2],
        };
        console.log(`tmux version: ${JSON.stringify(this.tmuxVersion_)}`);
      } catch (error) {
        console.warn('unable to parse version from ', lines);
        this.tmuxVersion_ = {major: 0, minor: ''};
      }

      const postInit = () => {
        this.onStart_(null);

        this.listWindows((windowDataList) => {
          for (const windowData of windowDataList) {
            this.internalOpenWindow_(windowData);
          }

          // Start handling changes to windows.
          this.handlers_['%window-add'] = this.handleWindowAdd_.bind(this);
          this.handlers_['%window-close'] =
              this.handlers_['%unlinked-window-close'] =
              this.handleWindowClose_.bind(this);
        });
      };

      if (this.checkTmuxMinVersion_({major: 3.2, minor: 'a'})) {
        // Set wait-exit so that tmux will wait for an empty line after it
        // outputs '%exit'. This prevent a race condition where we send tmux
        // commands after tmux exited.
        console.info('set wait-exit');
        this.queueCommand('refresh-client -f wait-exit', () => {
          this.waitExit_ = true;
          postInit();
        });
      } else {
        postInit();
      }
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
    // TODO(crbug.com/1252271): If there is any error, we log it and continue.
    // We might want to revisit this, since some of the errors might not be
    // recoverable.
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
    let tagEnd = line.indexOf(' ');
    if (tagEnd === -1) {
      tagEnd = line.length;
    }
    const tag = line.slice(0, tagEnd);
    const args = line.slice(tagEnd + 1);

    /** @type {!Command|undefined} */
    const currentCommand = this.commands_[0];
    if (tag === '%end' || tag === '%error') {
      if (args === currentCommand?.beginArgs) {
        currentCommand.finish(tag === '%end');
        this.commands_.shift();
        return;
      }

      console.warn(`encountered %end/%error tag but the args do not match: ` +
          `${args} !== ${currentCommand?.beginArgs}`);
    }

    if (currentCommand?.started) {
      currentCommand.appendToBuffer(line);
      return;
    }

    if (tag === '%begin') {
      if (!currentCommand) {
        throw new Error('unexpected %begin line: no current command');
      }
      currentCommand.start(args);
      return;
    }

    // TODO(crbug.com/1252271): handle all necessary notifications:
    // https://github.com/tmux/tmux/wiki/Control-Mode#notifications
    if (tag !== null) {
      const handler = this.handlers_[tag];
      if (handler) {
        handler(args);
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
   * @param {number=} history The number of lines before the visible area to
   *     get. The lines are also sent to `Window.onPaneOutput()`.
   */
  syncPane(paneId, history) {
    const pane = this.panes_.get(paneId);
    if (!pane) {
      throw new Error(`unknown pane: ${paneId}`);
    }
    // TODO(crbug.com/1252271): what if the pane is closed or moved to some
    // other window in the middle?

    // Capture history and visible area of the pane. Note that if there is a
    // fullscreen process (e.g. vim) running, then tmux does not give us the
    // history within the visible area.
    //
    // TODO(crbug.com/1252271): Try to fix the history in visible area issue.
    let capturePaneCommand = `capture-pane -peNJt ${paneId}`;
    if (history) {
      capturePaneCommand += ` -S -${history}`;
    }
    this.queueCommand(capturePaneCommand, (output) => {
      pane.winInfo.win.onPaneSyncStart(paneId);
      pane.winInfo.win.onPaneOutput(paneId, output.join('\r\n'));
    });

    // Capture and send incomplete escape sequence if there is any.
    this.queueCommand(`capture-pane -pPt ${paneId}`, (output) => {
      if (output.length === 0) {
        return;
      }
      if (output.length > 1) {
        // I don't think this should happen, but let print a warning just in
        // case.
        console.warn('multiple lines of incomplete escape sequences');
      }
      pane.winInfo.win.onPaneOutput(paneId, output.join('\r\n'));
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
   * Create a tmux window.
   */
  newWindow() {
    this.queueCommand(`new-window`);
  }

  /**
   * Kill a tmux window.
   *
   * @param {string} winId
   */
  killWindow(winId) {
    this.queueCommand(`kill-window -t ${winId}`);
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
    this.listWindowsImpl_('', callback);
  }

  /**
   * List one window.
   *
   * @param {string} winId
   * @param {function(?WindowData)} callback This will be called with the window
   *     data or null if we cannot find the window.
   */
  listWindow(winId, callback) {
    if (this.checkTmuxMinVersion_({major: 3.2, minor: 'a'})) {
      // Let tmux filter it by the window id.
      this.listWindowsImpl_(` -f "#{==:#{window_id},${winId}}"`, (windows) => {
        callback(windows[0] || null);
      });
      return;
    }

    this.listWindows((windows) => {
      callback(windows.find((w) => w.id === winId) || null);
    });
  }

  /**
   * @param {string} extra The extra string to be appended to the 'list-windows'
   *     command.
   * @param {function(!Array<!WindowData>)} callback
   */
  listWindowsImpl_(extra, callback) {
    const command = 'list-windows -F "#{window_id} #{window_layout}"' + extra;
    this.queueCommand(command,
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
   * Note that by design, when the result is ready (i.e. when
   * `this.interpretLine()` receives the corresponding '%end' notification),
   * `this.interpretLine()` will block until the callback returns. This is to
   * avoid race conditions. It is also the reason why we use a callback here
   * instead of making the function async. Callers who don't care about this can
   * make the callback function async.
   *
   * @param {string} command
   * @param {function(!Array<string>)=} callback The argument is an array of
   *     lines. The lines do not contain the ending '\r\n'.
   * @param {function(!Array<string>)=} errorCallback Like `callback`, but
   *     called if an error occurs.
   */
  queueCommand(command, callback = () => {},
      errorCallback = throwUnhandledCommandError) {
    this.pendingCommands_.push(new Command(command, callback, errorCallback));

    if (!this.sendPendingCommandsScheduled_) {
      this.sendPendingCommandsScheduled_ = true;
      // We send all pending commands together in the next event loop cycle.
      // This could mitigate some potential race conditions.
      setTimeout(this.sendPendingCommands_);
    }
  }

  sendPendingCommands_() {
    this.sendPendingCommandsScheduled_ = false;
    if (this.closed_) {
      console.warn('tmux is closed. Ignoring all pending commands');
      this.pendingCommands_.length = 0;
      return;
    }

    let joinedCommands = '';
    for (const command of this.pendingCommands_) {
      joinedCommands += command.commandStr + '\r';
      this.commands_.push(command);
    }
    this.pendingCommands_.length = 0;
    this.input_(joinedCommands);
  }

  /**
   * Check if tmux process has a version newer or equal to `tmuxVersion`.
   *
   * @param {!TmuxVersion} tmuxVersion
   * @return {boolean}
   */
  checkTmuxMinVersion_(tmuxVersion) {
    if (!this.tmuxVersion_) {
      throw new Error('version is not available');
    }
    const {major, minor} = this.tmuxVersion_;
    return major > tmuxVersion.major ||
        (major === tmuxVersion.major && minor >= tmuxVersion.minor);
  }

  /**
   * @param {!WindowData} windowData
   */
  internalOpenWindow_(windowData) {
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
   * Delete the window and associated panes.
   *
   * @param {!WinInfo} winInfo
   */
  deleteWindow_(winInfo) {
    for (const paneId of iterPaneIds(winInfo.layout)) {
      this.panes_.delete(paneId);
    }
    this.windows_.delete(winInfo.id);
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
   * Handler for '%output <paneId> <value>'
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

  /**
   * Handler for '%window-add <winId>'.
   *
   * @param {string} winId
   */
  handleWindowAdd_(winId) {
    checkWindowId(winId);
    this.listWindow(winId, (windowData) => {
      if (!windowData) {
        console.error(`unable to list window ${winId}`);
        return;
      }
      this.internalOpenWindow_(windowData);
    });
  }

  /**
   * The handler for both '%window-close <winId>' and '%unlink-window-close
   * <winId>'.
   *
   * @param {string} winId
   */
  handleWindowClose_(winId) {
    checkWindowId(winId);

    // It seems that tmux currently always uses '%unlink-window-close' no matter
    // whether the window being closed belonged to the current session or not.
    // Here we check whether the window is known first to ensure the behavior is
    // always correct.
    if (!this.windows_.has(winId)) {
      return;
    }
    const winInfo = this.windows_.get(winId);
    winInfo.win.onClose();
    this.deleteWindow_(winInfo);
  }

  handleExit_(text) {
    console.log(`tmux is exiting. Reason=${text}`);
    this.closed_ = true;

    if (this.waitExit_) {
      this.input_('\r');
    }
    this.input_ = () => {};

    for (const winInfo of this.windows_.values()) {
      winInfo.win.onClose();
    }
    this.windows_.clear();
    this.panes_.clear();
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
   * @param {string} commandStr
   * @param {function(!Array<string>)} callback The callback to invoke when the
   *     command finishes successfully.
   * @param {function(!Array<string>)} errorCallback Like `callback`, but called
   *     if an error occurs
   */
  constructor(commandStr, callback, errorCallback) {
    this.commandStr_ = commandStr;
    this.buffer_ = null;
    this.callback_ = callback;
    this.errorCallback_ = errorCallback;
    // The args following the %begin tag.
    this.beginArgs_ = null;
  }

  /** @return {string} */
  get commandStr() {
    return this.commandStr_;
  }

  /**
   * @return {?string} Return the %begin tag args or null if the command hasn't
   *     started yet.
   */
  get beginArgs() {
    return this.beginArgs_;
  }

  /**
   * Called when we receive the corresponding `%begin` notification.
   *
   * @param {string} beginArgs
   */
  start(beginArgs) {
    if (this.started) {
      throw new Error('command has already started');
    }
    this.buffer_ = [];
    this.beginArgs_ = beginArgs;
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
   *
   * @param {boolean} success
   */
  finish(success) {
    const callback = success ? this.callback_ : this.errorCallback_;
    callback(/** @type {!Array<string>} */(this.buffer_));

    this.buffer_ = null;
    this.callback_ = null;
    this.errorCallback_ = null;
  }
}

/** @param {!Array<string>} lines */
function throwUnhandledCommandError(lines) {
  throw new Error(`unhandled command error: ${lines.join('\n')}`);
}

/** @param {string} winId */
function checkWindowId(winId) {
  if (!winId.match(/^(@\d+)$/)) {
    throw new Error(`incorrrect window id : ${winId}`);
  }
}
