// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * A platform-app window containing an instance of hterm, running a
 * lib.wa.Executable ('/exe/wash' by default).
 */
wash.TerminalWindow = function(app) {
  this.app = app;

  console.log('wash: New terminal window.');

  this.wmWindow_ = app.wm.createWindow({id: 'wash'},
                                       this.onWindowCreated_.bind(this));
  /**
   * @type {hterm.Terminal}
   */
  this.term = null;

  /**
   * Event we invoke when async init is complete.
   */
  this.onInit = new lib.Event(this.onInit_.bind(this));

  // The 'ready' reply we get in reply to 'execute'.  Replies to 'ready' are
  // used as input to the executed command.
  this.readyMsg_ = null;
};

/**
 * The command to execute at startup.
 *
 * This must exist in the app filesystem, since we can't have mounted any
 * remote filesystems yet.
 */
wash.TerminalWindow.prototype.commandPath = '/exe/wash';

/**
 * The arg for the default command.
 */
wash.TerminalWindow.prototype.commandArg = null;

/**
 * Called when the platform app window is created.
 */
wash.TerminalWindow.prototype.onWindowCreated_ = function(contentNode) {
  this.contentNode_ = contentNode;
  this.document_ = contentNode.ownerDocument;
  this.document_.defaultView.addEventListener('resize',
                                              this.onResize_.bind(this));
  this.onResize_();

  this.term = new hterm.Terminal();
  this.term.decorate(contentNode);
  this.term.installKeyboard();

  this.term.io.onVTKeystroke = this.term.io.sendString =
      this.onSendString_.bind(this);
  this.term.io.onTerminalResize = this.onTerminalResize_.bind(this);

  this.document_.defaultView.addEventListener(
      'keydown', this.onKeyDown_.bind(this));
  this.term.keyboard.keyboardElement_.addEventListener(
      'keydown', this.onKeyDown_.bind(this));

  this.onInit();
};

wash.TerminalWindow.prototype.print = function(str) {
  this.term.io.print(str);
};

wash.TerminalWindow.prototype.println = function(str) {
  this.term.io.println(str);
};

/**
 * Handle for inbound messages from the default command.
 */
wash.TerminalWindow.prototype.onExecuteReply_ = function(msg) {
  if (msg.name == 'ready') {
    this.readyMsg_ = msg;

  } else if (msg.name == 'isatty') {
    msg.closeOk({columns: this.term.io.columnCount,
                 rows: this.term.io.rowCount});
  } else if (msg.name == 'strout' || msg.name == 'strerr') {
    var arg = msg.arg;
    if (typeof arg == 'string') {
      arg = arg.replace(/\n/g, '\r\n');
    } else {
      arg = String(arg);
    }

    this.print(arg);

    if (msg.isOpen)
      msg.closeOk(null);
  } else if (msg.name == 'error') {
    this.println('\x1b[37;41m ERROR \x1b[m ' + JSON.stringify(msg.arg));
  } else {
    console.log('Unknown message from terminal command: ' + msg.name);
  }
};

/**
 * The default command failed to start.
 */
wash.TerminalWindow.prototype.onExecuteError_ = function(msg) {
  this.print('Error executing ' + this.commandPath + ': ' +
             msg.name + ': ' + msg.arg);
};

/**
 * The default command exited.
 */
wash.TerminalWindow.prototype.onExecuteClosed_ = function(msg) {
  this.println('terminal: Command exited.');
};

/**
 * Window initialization is done.
 */
wash.TerminalWindow.prototype.onInit_ = function() {
  console.log('TerminalWindow: execute: ' + this.commandPath);
  this.execMsg = this.app.waitReady(
      'execute',
      {path: this.commandPath, arg: this.commandArg},
      this.onExecuteReply_.bind(this),
      this.onExecuteError_.bind(this));

  this.execMsg.onClose.addListener(this.onExecuteClosed_.bind(this));
};

/**
 * Called by hterm.Terminal.IO for keyboard events.
 *
 * We just forward them on to the default command.
 */
wash.TerminalWindow.prototype.onSendString_ = function(string) {
  if (this.readyMsg_)
    this.readyMsg_.reply('strin', string);
};

/**
 * Called by hterm.Terminal.IO when the terminal size changes.
 *
 * We just forward them on to the default command.
 */
wash.TerminalWindow.prototype.onTerminalResize_ = function(columns, rows) {
  if (this.readyMsg_)
    this.readyMsg_.reply('tty-resize', {columns: columns, rows: rows});
};

/**
 * Our own keyboard accelerators.
 *
 * TODO(rginda): ^C handling should probably go here, but we'll need a
 * way for apps to signal that they want to trap it.
 */
wash.TerminalWindow.prototype.onKeyDown_ = function(e) {
  if (e.ctrlKey && e.shiftKey && e.keyCode == ("R").charCodeAt())
    chrome.runtime.reload();
};

/**
 * Platform app window size changed.
 */
wash.TerminalWindow.prototype.onResize_ = function() {
  var bodyRect = this.document_.body.getBoundingClientRect();
  var contentRect = this.contentNode_.getBoundingClientRect();
  this.contentNode_.style.height = (bodyRect.height - contentRect.top) + 'px';
};
