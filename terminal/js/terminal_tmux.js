// Copyright 2021 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as tmux from './tmux.js';

/**
 * @fileoverview Code to support tmux intergration in the Terminal app.
 */

// TODO(1252271): Opening vim seems to kill the browser process. The
// cause seems to be invalid string encoding.

// TODO(1252271): I think we will want to support nested tmux controllers (i.e.
// running a tmux controller in a child window controled by another tmux
// controller). Let's make sure that works.

export const TMUX_CHANNEL_URL_PARAM_NAME = 'tmuxChannel';

/**
 * This class connects to the terminal IO and drives a `tmux.Controller`.
 */
export class TmuxControllerDriver {
  /**
   * @param {!hterm.Terminal} term
   */
  constructor(term) {
    /** @private {?tmux.Controller} */
    this.controller_ = null;
    this.term_ = term;
    /** @private {?Object} */
    this.ioPropertyBackup_ = null;
  }

  /**
   * Tmux in control mode sends a DCS sequence. This function installs a handler
   * to `hterm.VT.DCS` to handle that.
   *
   * TODO(1252271): move the parser to hterm.
   */
  installHtermTmuxParser() {
    /**
     * Parser for the content. This separates lines and passes them to the
     * controller.
     *
     * @param {!hterm.VT.ParseState} parseState
     */
    const tmuxContentParser = (parseState) => {
      const args = parseState.args;
      if (!args.length) {
        // This stores the unfinished line.
        args[0] = '';
      }
      // Consume as many lines as possible.
      while (true) {
        const buf = parseState.peekRemainingBuf();
        const lineEnd = buf.indexOf('\r\n');
        if (lineEnd === -1) {
          parseState.args[0] += buf;
          parseState.resetBuf();
          return;
        }
        const line = args[0] + buf.slice(0, lineEnd);
        args[0] = '';
        parseState.advance(lineEnd + 2);
        this.controller_.interpretLine(line);
        if (line.startsWith('%exit')) {
          // tmux is exiting.
          parseState.resetArguments();
          parseState.func = stParser;
          this.onStop_();
          return;
        }
      }
    };

    /**
     * Parser for the ST when the DCS sequence is ending.
     *
     * @this {!hterm.VT}
     * @param {!hterm.VT.ParseState} parseState
     */
    function stParser(parseState) {
      // TODO(1252271): Ideally, we don't use private functions. This will be
      // removed later when we are able to move the parser to hterm.
      if (!this.parseUntilStringTerminator_(parseState)) {
        console.error('failed to parse string terminator');
        return;
      }

      if (parseState.func !== stParser) {
        // Parsing is done!
        if (parseState.args[0]) {
          console.error(
              `extra data before the string terminator: ${parseState.args[0]}`);
        }
        parseState.resetArguments();
      }
    }

    /** @param {!hterm.VT.ParseState} parseState */
    hterm.VT.DCS['p'] = (parseState) => {
      const args = parseState.args;
      // If it is tmux DCS sequence, we override the parse function.
      if (args.length === 1 && args[0] === '1000') {
        parseState.resetArguments();
        parseState.func = tmuxContentParser;
        this.onStart_();
      }
    };
  }

  /**
   * Start handling tmux control mode.
   */
  onStart_() {
    const io = this.term_.io;

    const sendString = io.sendString.bind(io);
    this.ioPropertyBackup_ = {};
    // We want to block all user input so that the controller can talk to the
    // tmux process uninterruptedly. Note that we cannot do `io.push()` instead,
    // since it causes buffering of tmux's output.
    //
    // TODO(1252271): Need to figure out how to make it easy for user to kill
    // the tmux process (because ctrl-c won't work any more).
    for (const name of ['onVTKeystroke', 'sendString']) {
      this.ioPropertyBackup_[name] = io[name];
      io[name] = () => {};
    }

    this.controller_ = new tmux.Controller({
      openWindow: ({windowId, controller}) => {
        return new ServerWindow({windowId, controller});
      },
      input: sendString,
    });
    this.controller_.start();
  }

  /**
   * Stop handling tmux control mode.
   */
  onStop_() {
    this.controller_ = null;
    for (const name in this.ioPropertyBackup_) {
      this.term_.io[name] = this.ioPropertyBackup_[name];
    }
    this.ioPropertyBackup_ = null;
  }
}


/**
 * Return a proxy object `o` such that `o.foo(1, 2, 3)` will call `func(['foo',
 * 1, 2, 3])`
 *
 * @param {function(!Array)} func
 * @return {!Proxy}
 */
function createMethodProxy(func) {
  return new Proxy({}, {
    get: function(target, prop) {
      return (...args) => {
        func([prop, ...args]);
      };
    },
  });
}

/**
 * `dispatchMethod(o, ['foo', 1, 2, 3])` will call `o.foo(1, 2, 3)`.
 *
 * @param {!Object} obj
 * @param {!Array} data
 */
function dispatchMethod(obj, data) {
  obj[data[0]](...data.slice(1));
}

let uniqueIdCounter = 0;

/**
 * Return a (hopefully) universal unique id.
 *
 * @return {string}
 */
function uniqueId() {
  ++uniqueIdCounter;
  return `${Math.random().toString().substring(2)}` +
      `-${Date.now()}-${uniqueIdCounter}`;
}

/**
 * A pair of ServerChannel and ClientChannel communicate over a
 * BroadcastChannel with the same channel name. Although we use BroadcastChannel
 * here, the communication is in unicast manner. At the beginning, there is a
 * handshake procedure for the pair to set up a session id.
 *
 * - At the very beginning, ClientChannel sents `['CONNECT', {requestId:
 *   '...'}]` to the BroadcastChannel.
 * - The ServerChannel on the same BroadcastChannel recieves the request, it
 *   'disconnect' any previous connected ClientChannel, and replies
 *   `['CONNECTED', {sessionId: '...', requestId: '...'}]`. The requestId should
 *   match the one sent by the ClientChannel. After this, both the ServerChannel
 *   and the ClientChannel know about the session id.
 *
 * After setting up the session id, the two channels send each other messages in
 * this format `[sessionId, actualPayload]`.
 */
class ServerChannel {
  /**
   * Construct a ServerChannel. Note that `onConnected()` could be called
   * multiple times, when this happens, the previous connection should be
   * considered dropped.
   *
   * @param {{
   *   channelName: string,
   *   onConnected: function(),
   *   onData: function(*),
   * }} param1
   */
  constructor({channelName, onConnected, onData}) {
    this.onConnected_ = onConnected;
    this.onData_ = onData;

    this.channel_ = new BroadcastChannel(channelName);
    this.channel_.onmessage = this.onMessage_.bind(this);
    this.sessionId_ = 0;
  }

  /**
   * Post a message. This should only be called after `onConnected` has been
   * called.
   *
   * @param {*} message
   */
  postMessage(message) {
    this.channel_.postMessage([this.sessionId_, message]);
  }

  /**
   * @param {!MessageEvent} ev
   */
  onMessage_(ev) {
    const sessionId = ev.data[0];
    const payload = ev.data[1];

    if (sessionId === 'CONNECT') {
      ++this.sessionId_;
      this.channel_.postMessage(['CONNECTED', {
        sessionId: this.sessionId_,
        requestId: payload.requestId,
      }]);
      this.onConnected_();
      return;
    }

    if (!sessionId || sessionId !== this.sessionId_) {
      console.warn('unknown or invalid session id. Discard message');
      return;
    }

    this.onData_(payload);
  }
}

/**
 * Client end of the channel. See `ServerChannel` for details.
 */
class ClientChannel {
  constructor({channelName, onConnected, onData}) {
    this.onConnected_ = onConnected;
    this.onData_ = onData;

    this.channel_ = new BroadcastChannel(channelName);
    this.sessionId_ = null;

    const requestId = uniqueId();
    this.channel_.postMessage(['CONNECT', {requestId}]);
    this.channel_.onmessage = (ev) => {
      if (ev.data[0] !== 'CONNECTED' || ev.data[1].requestId != requestId) {
        throw new Error('unable to connect');
      }
      this.sessionId_ = ev.data[1].sessionId;
      this.channel_.onmessage = this.onMessage_.bind(this);
      this.onConnected_();
    };
  }

  /**
   * Post a message. This should only be called after `onConnected` has been
   * called.
   *
   * @param {*} data
   */
  postMessage(data) {
    this.channel_.postMessage([this.sessionId_, data]);
  }

  /**
   * @param {!MessageEvent} ev
   */
  onMessage_(ev) {
    // This can also happen when another client is trying to connect.
    if (ev.data[0] !== this.sessionId_) {
      this.channel_.close();
      this.channel_ = null;
      throw new Error('unmatched session id');
    }
    this.onData_(ev.data[1]);
  }
}

/**
 * The window class on the server end (i.e. the tab running `tmux.Controller`).
 * What it mainly does is to control and communicate with ClientWindow in
 * another tab.
 *
 * @unrestricted
 */
class ServerWindow extends tmux.Window {
  /**
   * @param {{
   *   windowId: string,
   *   controller: !tmux.Controller,
   * }} param1
   */
  constructor({windowId, controller}) {
    super();
    this.windowId_ = windowId;
    this.controller_ = controller;

    const channelName = uniqueId();
    this.channel_ = new ServerChannel({
      channelName,
      onConnected: this.onConnected_.bind(this),
      onData: this.onData_.bind(this),
    });
    /**
     * Trick closure compiler to consider the rpc object a ClientWindow.
     *
     * @suppress {checkTypes}
     */
    this.clientWindowRpc_ = /** @type {!ClientWindow} */(createMethodProxy(
        (data) => this.channel_.postMessage(data)));

    const url = `${location.origin}/html/terminal.html?` +
        `${TMUX_CHANNEL_URL_PARAM_NAME}=${encodeURIComponent(channelName)}`;
    chrome.terminalPrivate.openWindow({url});

    for (const method of ['onLayoutUpdate', 'onPaneOutput',
        'onPaneCursorUpdate', 'onPaneSyncStart']) {
      this[method] = this.clientWindowRpc_[method];
    }
  }

  /**
   * Request the up-to-date layout to be sent to `onLayoutUpdate`.
   *
   * @param {string} winId
   */
  requestLayoutUpdate(winId) {
    const layout = this.controller_.getLayout(winId);
    if (!layout) {
      throw new Error(`unable to get layout for window ${winId}`);
    }
    this.clientWindowRpc_.onLayoutUpdate(layout);
  }

  /** @override */
  onClose() {
    // TODO(1252271): kill the client window.
  }

  /**
   * @param {!Array} data
   */
  onData_(data) {
    if (data[0] in this) {
      dispatchMethod(this, data);
    } else {
      dispatchMethod(this.controller_, data);
    }
  }

  /** Called when the channel is connected. */
  onConnected_() {
    this.clientWindowRpc_.init(this.windowId_);
  }
}

/**
 * The window class on the client end. It communicates with ServerWindow running
 * in another tab.
 *
 * Note that ClientWindow does not actually extend tmux.Window since we don't
 * pass it to tmux.Controller. But it should implement all the methods, so we
 * use the '@extends' below to trick Closure Compiler into checking that for us.
 *
 * @unrestricted
 * @extends {tmux.Window}
 */
export class ClientWindow {
  constructor({channelName, term}) {
    this.term_ = term;
    this.io_ = term.io;

    this.windowId_ = null;
    /** @private {null|string} */
    this.paneId_ = null;

    this.channel_ = new ClientChannel({
      channelName,
      // We don't need to do anything here, because ServerWindow will call
      // `this.init()`.
      onConnected: () => {},
      onData: this.onData_.bind(this),
    });

    // The ServerWindow either routes the rpc calls to itself or the controller.
    // In order to satisfy closure compiler, we use two variables here and
    // mark them as either a ServerWindow or a tmux.Controller.
    /** @suppress {checkTypes} */
    this.controllerRpc_ = /** @type {!tmux.Controller} */(createMethodProxy(
        (data) => this.channel_.postMessage(data)));
    /** @suppress {checkTypes} */
    this.serverWindowRpc_ = /** @type {!ServerWindow} */(this.controllerRpc_);

    this.paneSyncStarted_ = false;

    this.io_.onVTKeystroke = this.io_.sendString = this.sendString_.bind(this);
  }

  /**
   * To be called by ServerWindow at the beginning.
   *
   * @param {string} windowId
   */
  init(windowId) {
    this.windowId_ = windowId;
    this.serverWindowRpc_.requestLayoutUpdate(windowId);
  }

  /** @override */
  onPaneOutput(paneId, data) {
    if (paneId !== this.paneId_) {
      console.warn(`Unexpected paneId ${paneId}`);
      return;
    }
    if (this.paneSyncStarted_) {
      this.io_.print(data);
    }
  }

  /** @override */
  onPaneSyncStart(paneId) {
    if (paneId !== this.paneId_) {
      console.error(`Unexpected paneId ${paneId}`);
      return;
    }
    this.paneSyncStarted_ = true;
  }

  /** @override */
  onLayoutUpdate(layout) {
    // TODO(1252271): The logic here is temporary. We need to properly handle
    // resizing, pane id update, and multi-panes...

    if (!layout.paneId) {
      // Layout is a complex layout with multiple panes.
      this.warn_('multi-pane windows are not supported yet');
      this.paneId_ = null;
      return;
    }

    if (this.paneId_ === null) {
      this.paneId_ = layout.paneId;
    } else if (this.paneId_ !== layout.paneId) {
      this.warn_('changing pane in a window is not supported yet');
      this.paneId_ = null;
      return;
    }

    const screenSize = this.term_.screenSize;
    if (layout.xSize !== screenSize.width ||
        layout.ySize !== screenSize.height) {
      // TODO(1252271): temporary solution for preventing infinate loop if for
      // some reason tmux refused to resize.
      if (++this.resizeCount_ > 3) {
        throw new Error('resized too many times');
      }
      this.controllerRpc_.resizeWindow(/** @type {string} */(this.windowId_),
          this.term_.screenSize.width, this.term_.screenSize.height);
      return;
    }

    this.resizeCount_ = 0;
    this.controllerRpc_.syncPane(/** @type {string} */(this.paneId_));
  }

  /** @override */
  onPaneCursorUpdate(paneId, x, y) {
    // TODO(1252271): avoid calling hterm's private function?
    this.term_.scheduleSyncCursorPosition_();
    this.term_.restoreCursor({row: y, column: x});
  }

  /**
   * @param {string} text
   */
  sendString_(text) {
    if (this.paneId_ === null) {
      console.warn('ignore data since pane id has not been initialized');
      return;
    }
    this.controllerRpc_.sendPaneInput(this.paneId_, text);
  }

  /**
   * @param {string} text
   */
  warn_(text) {
    console.warn(text);
    this.io_.print(text);
  }

  /**
   * @param {!Array} data
   */
  onData_(data) {
    dispatchMethod(this, data);
  }
}
