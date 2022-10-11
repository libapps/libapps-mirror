// Copyright 2021 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as tmux from './tmux.js';

/**
 * @fileoverview Tmux integration for hterm. It also provides the
 * infrastructure to support hosting tmux windows in different tabs over
 * broadcast channels.
 *
 * TODO(1252271): Better documentation (e.g. description and relation for the
 * main components, and the two flows of new window).
 */

// TODO(1252271): Opening vim seems to kill the browser process. The
// cause seems to be invalid string encoding.

// TODO(1252271): I think we will want to support nested tmux controllers (i.e.
// running a tmux controller in a child window controled by another tmux
// controller). Let's make sure that works.

/**
 * This provides a command line interface for the user to interact with tmux
 * (e.g. stop tmux and run tmux commands) in control mode.
 */
export class PseudoTmuxCommand {
  /**
   * @param {!hterm.Terminal} term The terminal to "run" the pseudo command.
   *     Note that we use `term.print()` instead of `term.io.print()` because
   *     the latter goes through the `hterm.VT` stack and will interfere with
   *     the on-going tmux control mode DCS sequence.
   * @param {!tmux.Controller} controller
   */
  constructor(term, controller) {
    this.term_ = term;
    this.controller_ = controller;
    this.buffer_ = '';
  }

  /**
   * Start "running" the command.
   */
  run() {
    // TODO(1252271): Consider i18n all the user facing messages.
    this.term_.print(
        '(Entered tmux control mode. Input tmux commands or Ctrl-C to detach)');
    this.term_.newLine();
    this.prompt_();
  }

  /**
   * Print a prompt.
   */
  prompt_() {
    this.term_.print('>>> ');
  }

  /**
   * To be called with user input.
   *
   * @param {string} string
   */
  onUserInput(string) {
    for (const c of string) {
      switch (c) {
        // Ctrl-C & Ctrl-D
        case '\x03':
        case '\x04':
          this.controller_.detach();
          this.term_.newLine();
          return;
        // Backspace.
        case '\x7f':
          if (this.buffer_) {
            this.buffer_ = this.buffer_.slice(0, -1);
            this.term_.cursorLeft(1);
            this.term_.print(' ');
            this.term_.cursorLeft(1);
          } else {
            this.term_.ringBell();
          }
          break;
        case '\r': {
          const command = this.buffer_.trim();
          this.buffer_ = '';

          this.term_.newLine();
          if (!command) {
            this.prompt_();
            continue;
          }

          const callback = (lines) => {
            printLines(this.term_, lines);
            this.prompt_();
          };

          this.controller_.queueCommand(command, callback, callback);
          break;
        }
        default:
          // Only handle printable ASCII character for now.
          if (c >= ' ' && c <= '~') {
            this.buffer_ += c;
            this.term_.print(c);
            break;
          }
          this.term_.ringBell();
          break;
      }
    }
  }
}

/**
 * A channel hosted by TmuxControllerDriver. This allows users to send requests
 * to the driver remotely.
 *
 * This currently is only used by `ClientWindow.open()` to request a tmux
 * window (and the associated ServerWindow). The protocol is as follows:
 *
 * - ClientWindow side sends `{id: '...'}`
 * - If successful, the driver responds with `{id: '...', windowChannelName:
 *   '...'}`; otherwise, the driver responds with `{id: '...', error: '...'}`.
 *   The id here should match the one in the last step.
 */
export class DriverChannel {
  /**
   * @param {function(string)} onRequestOpenWindow
   */
  constructor(onRequestOpenWindow) {
    this.onRequestOpenWindow_ = onRequestOpenWindow;

    this.channelName_ = uniqueId();
    this.channel_ = new BroadcastChannel(this.channelName_);
    this.channel_.onmessage = this.onMessage_.bind(this);
  }

  /**
   * Request to open a tmux window and the associated ServerWindow.
   *
   * @param {string} driverChannelName The channel name of the DriverChannel to
   *     which we send the request.
   * @return {!Promise<string>} The channel name of the newly opened
   *     ServerWindow.
   * @throws {!Error}
   */
  static async requestOpenWindow(driverChannelName) {
    return new Promise((resolve, reject) => {
      const id = uniqueId();
      const driverChannel = new BroadcastChannel(driverChannelName);
      driverChannel.onmessage = (ev) => {
        if (ev.data.id !== id) {
          return;
        }

        if (ev.data.error !== undefined) {
          reject(new Error(ev.data.error));
        } else {
          resolve(ev.data.windowChannelName);
        }
        driverChannel.close();
      };

      setTimeout(() => {
        // This is fine because first resolve/reject wins. See
        // https://262.ecma-international.org/6.0/#sec-promise-reject-functions
        reject(new Error('timeout'));
      }, 5 * 1000);

      driverChannel.postMessage({id});
    });
  }

  /**
   * @return {string} The channel name.
   */
  get channelName() {
    return this.channelName_;
  }

  /**
   * Resolve a request for a server window.
   *
   * @param {string} id The request id.
   * @param {(string|undefined)} windowChannelName The channelName for the newly
   *     opened ServerWindow if it was successful.
   * @param {(string|undefined)} error The error message if there is one.
   */
  resolve(id, windowChannelName, error) {
    this.channel_.postMessage({id, windowChannelName, error});
  }

  /**
   * @param {!MessageEvent} ev
   */
  onMessage_(ev) {
    const {id} = ev.data;
    this.onRequestOpenWindow_(ev.data.id);
  }
}

/**
 * This class connects to the terminal IO and drives a `tmux.Controller`.
 *
 * TODO(1252271): We should add a close method. And it should properly close all
 * the broadcast channel (e.g. DriverChannel and ServerChannel).
 */
export class TmuxControllerDriver {
  /**
   * Construct a tmux controller driver.
   *
   * @param {{
   *   term: !hterm.Terminal,
   *   onOpenWindow: function({driver, channelName}),
   * }} obj onOpenWindow() will be called with `this` and the channel name for
   *     the new window (unless the window is requested by
   *     `ClientWindow.open()`). The callback should construct a `ClientWindow`
   *     with the channel name.
   *
   */
  constructor({term, onOpenWindow}) {
    this.term_ = term;
    this.onOpenWindow_ = onOpenWindow;

    /** @private {?tmux.Controller} */
    this.controller_ = null;
    /** @private {?Object} */
    this.ioPropertyBackup_ = null;
    /** @private {?PseudoTmuxCommand} */
    this.pseudoTmuxCommand_ = null;
    /** @const @private {!Set<!ServerWindow>} */
    this.serverWindows_ = new Set();
    this.active_ = false;

    /** @const @private {!Array<string>} */
    this.pendingOpenWindowRequests_ = [];
    this.driverChannel_ = new DriverChannel(
        this.onRequestOpenWindow_.bind(this));

    this.onUnload_ = this.onUnload_.bind(this);
    this.onUserInput_ = this.onUserInput_.bind(this);
  }

  get active() {
    return this.active_;
  }

  get channelName() {
    return this.driverChannel_.channelName;
  }

  /**
   * Install the driver to the hterm.Terminal object.
   */
  install() {
    this.term_.onTmuxControlModeLine = this.onTmuxControlModeLine_.bind(this);
  }

  onTmuxControlModeLine_(line) {
    if (!this.active_) {
      this.onStart_();
    }

    if (line !== null) {
      this.controller_.interpretLine(line);
      return;
    }

    this.onStop_();
  }

  /**
   * Start handling tmux control mode.
   */
  onStart_() {
    this.active_ = true;

    window.addEventListener('unload', this.onUnload_);

    const io = this.term_.io;

    this.ioPropertyBackup_ = {};
    this.controller_ = new tmux.Controller({
      openWindow: this.openWindow_.bind(this),
      input: io.sendString.bind(io),
      onStart: () => {
        this.pseudoTmuxCommand_ = new PseudoTmuxCommand(
            this.term_, /** @type {!tmux.Controller} */(this.controller_));
        this.pseudoTmuxCommand_.run();
      },
      onError: (msg) => {
        printLines(this.term_, [
          'Tmux controller encountered an error:',
          ...msg.trim().split('\n'),
        ]);
      },
    });

    // Backup and overwrite the input methods on the `io` object because we want
    // our pseudo tmux command to handle user input on the current terminal.
    // Note that we cannot do `io.push()` instead, since it causes buffering of
    // tmux process output.
    for (const name of ['onVTKeystroke', 'sendString']) {
      this.ioPropertyBackup_[name] = io[name];
      io[name] = this.onUserInput_;
    }
  }

  /**
   * Handle user input when tmux is active.
   *
   * @param {string} str
   */
  onUserInput_(str) {
    if (this.pseudoTmuxCommand_) {
      this.pseudoTmuxCommand_.onUserInput(str);
      return;
    }
    console.warn(
        'unhandled user input when the controller hasn\'t started: ', str);
  }

  /**
   * @param {{
   *   windowId: string,
   *   controller: !tmux.Controller,
   * }} obj
   * @return {!ServerWindow}
   */
  openWindow_({windowId, controller}) {
    const serverWindow = new ServerWindow({
      windowId,
      controller,
      onClose: () => {
        this.serverWindows_.delete(serverWindow);
      },
    });
    this.serverWindows_.add(serverWindow);

    const pendingRequest = this.pendingOpenWindowRequests_.shift();
    if (pendingRequest) {
      this.driverChannel_.resolve(pendingRequest, serverWindow.channelName,
          undefined);
    } else {
      this.onOpenWindow_({driver: this, channelName: serverWindow.channelName});
    }

    return serverWindow;
  }

  /**
   * Stop handling tmux control mode.
   */
  onStop_() {
    this.active_ = false;

    window.removeEventListener('unload', this.onUnload_);
    this.cleanUpPendingOpenWindowRequests_('controller has stopped');

    this.controller_ = null;
    this.pseudoTmuxCommand_ = null;

    for (const name in this.ioPropertyBackup_) {
      this.term_.io[name] = this.ioPropertyBackup_[name];
    }
    this.ioPropertyBackup_ = null;
    if (this.serverWindows_.size) {
      // The controller should have received an "%exit" notification and closed
      // all the windows.
      console.warn(
          'serverWindows_ is not empty when the tmux process has stopped');
      for (const serverWindow of Array.from(this.serverWindows_)) {
        serverWindow.onClose();
      }
      this.serverWindows_.clear();
    }
  }

  onUnload_() {
    // Note that we copy the set to an array first because closing a server
    // window will affect the set.
    for (const serverWindow of Array.from(this.serverWindows_)) {
      serverWindow.onClose();
    }
    this.cleanUpPendingOpenWindowRequests_('driver\'s page is unloading');
  }

  /**
   * @param {string} reason This will be sent as the error message for the
   *     requests.
   */
  cleanUpPendingOpenWindowRequests_(reason) {
    for (const id of this.pendingOpenWindowRequests_) {
      console.warn(`clean up open window request ${id}`);
      this.driverChannel_.resolve(id, undefined, reason);
    }
  }

  /**
   * @param {string} id
   */
  onRequestOpenWindow_(id) {
    if (!this.controller_) {
      console.warn(
          `controller does not exist. Rejecting open window request ${id}`);
      this.driverChannel_.resolve(id, undefined, 'controller does not exist');
      return;
    }

    this.pendingOpenWindowRequests_.push(id);
    this.controller_.newWindow();
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
 * - At the very beginning, ClientChannel sends `['CONNECT', {requestId:
 *   '...'}]` to the BroadcastChannel.
 * - The ServerChannel on the same BroadcastChannel recieves the request, it
 *   'disconnect' any previous connected ClientChannel, and replies
 *   `['CONNECTED', {sessionId: '...', requestId: '...'}]`. The requestId should
 *   match the one sent by the ClientChannel. After this, both the ServerChannel
 *   and the ClientChannel know about the session id.
 *
 * After setting up the session id, the two channels send each other messages in
 * this format `[sessionId, actualPayload]`.
 *
 * TODO(1252271): There are a lot of reasons that the server-client connection
 * can go wrong. We should implement some heartbeat logic to detect and handle
 * the issue (e.g. close/re-open window).
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
   *   onClose: function(),
   * }} param1 onClose() will be called when this.onClose() is called.
   */
  constructor({windowId, controller, onClose}) {
    super();
    this.windowId_ = windowId;
    this.controller_ = controller;
    this.onClose_ = onClose;

    this.channelName_ = uniqueId();
    this.channel_ = new ServerChannel({
      channelName: this.channelName_,
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

    // TODO(1252271): We should be able to use something like Proxy to avoid
    // spelling out the methods.
    for (const method of ['onLayoutUpdate', 'onPaneOutput',
        'onPaneSyncStart']) {
      this[method] = this.clientWindowRpc_[method];
    }
  }

  get channelName() {
    return this.channelName_;
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

  /**
   * Kill the corresponding window in tmux.
   */
  killWindow() {
    // Tmux should then call `this.onClose()` eventually.
    this.controller_.killWindow(this.windowId_);
  }

  /** @override */
  onClose() {
    this.clientWindowRpc_.onClose();
    this.onClose_();
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

const SYNC_PANE_HISTORY_SIZE = 1000;

/**
 * The window class on the client end. It communicates with the corresponding
 * tmux window / ServerWindow over a broadcast channel.
 *
 * Note that ClientWindow does not actually extend tmux.Window since we don't
 * pass it to tmux.Controller. But it should implement all the methods, so we
 * use the '@extends' below to trick Closure Compiler into checking that for us.
 *
 * @unrestricted
 * @extends {tmux.Window}
 */
export class ClientWindow {
  /**
   * Construct a client window (when you already knows the window channel name).
   * Also see the open() static function in this class.
   *
   * @param {{
   *   channelName: string,
   *   term: !hterm.Terminal,
   * }} obj
   */
  constructor({channelName, term}) {
    this.term_ = term;
    this.io_ = term.io;
    this.channelName_ = channelName;

    this.term_.setWindowTitle = (title) => {
      document.title = `[tmux] ${title}`;
    };

    /** @private {?string} */
    this.windowId_ = null;
    this.closed_ = false;
    /** @private {?tmux.SimpleLayout} */
    this.layout_ = null;
    this.isFirstLayoutUpdate_ = true;

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
    this.io_.onTerminalResize = this.reconcileTmuxWindowSize_.bind(this);


    window.addEventListener('beforeunload', (e) => {
      if (!this.closed_) {
        // Display a warning before closing.
        e.returnValue = '';
      }
    });

    window.addEventListener('unload', () => {
      // If we have already received a `onClose()` from the server side, there
      // is no need to kill the window.
      if (!this.closed_) {
        // This is a bit more reliable than `this.controllerRpc_.killWindow()`
        // since it does not need `this.windowId_` to be initialized.
        this.serverWindowRpc_.killWindow();
      }
    });
  }

  /**
   * Open a new ClientWindow, a new tmux window / ServerWindow will also open on
   * the driver side.
   *
   * @param {{
   *   driverChannelName: string,
   *   term: !hterm.Terminal,
   * }} obj
   * @return {!Promise<!ClientWindow>}
   * @throws {!Error}
   */
  static async open({driverChannelName, term}) {
    console.log('requesting server window from: ', driverChannelName);
    const channelName = await DriverChannel.requestOpenWindow(
        driverChannelName);
    console.log('got channelName: ', channelName);
    return new ClientWindow({
      channelName: channelName,
      term,
    });
  }

  /**
   * @return {string} The channel name.
   */
  get channelName() {
    return this.channelName_;
  }

  /**
   * To be called by ServerWindow at the beginning.
   *
   * @param {string} windowId
   */
  init(windowId) {
    console.log(`ClientWindow inited with windowId=${windowId}`);
    this.windowId_ = windowId;
    this.serverWindowRpc_.requestLayoutUpdate(windowId);
  }

  /** @override */
  onPaneOutput(paneId, data) {
    if (paneId !== this.layout_?.paneId) {
      console.warn(`Unexpected paneId ${paneId}`);
      return;
    }
    if (this.paneSyncStarted_) {
      this.io_.print(data);
    }
  }

  /** @override */
  onPaneSyncStart(paneId) {
    if (paneId !== this.layout_?.paneId) {
      console.error(`Unexpected paneId ${paneId}`);
      return;
    }
    console.log('pane sync started');
    this.paneSyncStarted_ = true;
  }

  /** @override */
  onLayoutUpdate(layout) {
    const isFirstLayoutUpdate = this.isFirstLayoutUpdate_;
    this.isFirstLayoutUpdate_ = false;

    if (!layout.paneId) {
      // Layout is a complex layout with multiple panes.
      if (this.layout_ !== null) {
        this.layout_ = null;
        this.term_.wipeContents();
      }
      this.error_('multi-pane windows are not supported yet');
      return;
    }

    const oldLayout = this.layout_;
    this.layout_ = /** @type {!tmux.SimpleLayout}*/(layout);

    // Don't proactively reconcile the size unless this is the first time we
    // connect to tmux.
    if (isFirstLayoutUpdate) {
      this.reconcileTmuxWindowSize_();
    }

    if (this.layout_.paneId !== oldLayout?.paneId) {
      console.log(`updating paneId from ${oldLayout?.paneId} ` +
          `to ${this.layout_.paneId}`);
      // TODO(crbug.com/1252271): We might also want to reset other status of
      // the terminal here.
      this.term_.wipeContents();
      this.paneSyncStarted_ = false;
      // TODO(crbug.com/1252271): Ideally, we don't want to just pull in a fixed
      // amount of history at the beginning. Instead, we want to retrieve
      // history dynamically when the user scrolls up.
      this.controllerRpc_.syncPane(this.layout_.paneId, SYNC_PANE_HISTORY_SIZE);
    }
  }

  /** @override */
  onClose() {
    this.closed_ = true;
    window.close();
  }

  /**
   * @param {string} text
   */
  sendString_(text) {
    if (this.layout_ === null) {
      console.warn('ignore data since pane id has not been initialized');
      return;
    }
    this.reconcileTmuxWindowSize_();
    this.controllerRpc_.sendPaneInput(this.layout_.paneId, text);
  }

  /**
   * Resize the tmux window to match the terminal window if necessary.
   */
  reconcileTmuxWindowSize_() {
    if (this.layout_ === null) {
      return;
    }

    const {width, height} = this.term_.screenSize;
    if (this.layout_.xSize === width && this.layout_.ySize === height) {
      return;
    }

    // TODO(1252271): Calling resize-window causes the window-size option to be
    // set to manual, and then the regular tmux client will not resize the
    // window automatically any more. Maybe we should use something like
    // `refresh-client -C` or just reset the window option afterwards.
    this.controllerRpc_.queueCommand(
        `resize-window -t ${this.windowId_} -x ${width} -y ${height}`);
    // Activate the current window. Otherwise, tmux might not actually resize
    // it.
    this.controllerRpc_.queueCommand(`select-window -t ${this.windowId_}`);
  }

  /**
   * @param {string} text
   */
  error_(text) {
    console.error(text);
    this.io_.print(text);
  }

  /**
   * @param {!Array} data
   */
  onData_(data) {
    dispatchMethod(this, data);
  }
}

/**
 * @param {!hterm.Terminal} term
 * @param {!Array<string>} lines
 */
function printLines(term, lines) {
  for (const line of lines) {
    term.print(line);
    term.newLine();
  }
}
