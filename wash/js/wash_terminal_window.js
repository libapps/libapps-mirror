// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * A platform-app window containing an instance of hterm, running a
 * wam executable.
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
};

wash.TerminalWindow.prototype.defaultEnv = {TERM: 'xterm-256color'};

/**
 * The command to execute at startup.
 *
 * This must exist in the app filesystem, since we can't have mounted any
 * remote filesystems yet.
 */
wash.TerminalWindow.prototype.commandPath = '/apps/wash/exe/wash';

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
  this.document_.defaultView.addEventListener
  ('resize', this.onResize_.bind(this));
  this.document_.querySelector('#wash_window_close').addEventListener
  ('click', function() { this.executeContext.closeOk(null) }.bind(this));

  this.onResize_();

  this.term = new hterm.Terminal();
  this.term.onTerminalReady = this.onInit;

  this.term.decorate(contentNode);
  this.term.installKeyboard();

  this.term.io.onVTKeystroke = this.term.io.sendString =
      this.onSendString_.bind(this);
  this.term.io.onTerminalResize = this.onTerminalResize_.bind(this);

  this.document_.defaultView.addEventListener(
      'keydown', this.onKeyDown_.bind(this));
};

wash.TerminalWindow.prototype.print = function(str) {
  this.term.io.print(str);
};

wash.TerminalWindow.prototype.println = function(str) {
  this.term.io.println(str);
};

/**
 * Window initialization is done.
 */
wash.TerminalWindow.prototype.onInit_ = function() {
  this.executeContext = this.app.jsfs.defaultBinding.createExecuteContext();
  this.executeContext.setEnvs(this.defaultEnv);
  this.executeContext.onClose.addListener(this.onExecuteClose_, this);
  this.executeContext.onStdOut.addListener(this.onStdOut_, this);
  this.executeContext.onStdErr.addListener(this.onStdOut_, this);
  this.executeContext.onTTYRequest.addListener(this.onTTYRequest_, this);
  this.executeContext.setTTY
  ({rows: this.term.io.rowCount,
    columns: this.term.io.columnCount
   });

  this.executeContext.onReady.addListener(function() {
      console.log('TerminalWindow: execute ready');
    });

  this.executeContext.onClose.addListener(function(reason, value) {
      console.log('TerminalWindow: execute closed: ' + reason +
                  JSON.stringify(value));
    });

  console.log('TerminalWindow: execute: ' + this.commandPath);
  this.executeContext.execute(this.commandPath, this.commandArg);
};

/**
 * The default command exited.
 */
wash.TerminalWindow.prototype.onExecuteClose_ = function(reason, value) {
  if (reason == 'ok') {
    this.wmWindow_.close();

  } else {
    this.print('Error executing ' + this.commandPath + ': ' +
               JSON.stringify(value));
  }
};

wash.TerminalWindow.prototype.onTTYRequest_ = function(request) {
  console.log('tty request');
  if (typeof request.interrupt == 'string')
    this.executeContext.setTTY({interrupt: request.interrupt});
};

/**
 * Handle for inbound messages from the default command.
 */
wash.TerminalWindow.prototype.onStdOut_ = function(str, opt_onAck) {
  if (typeof str == 'string') {
    str = str.replace(/\n/g, '\r\n');
  } else {
    str = JSON.stringify(str) + '\r\n';
  }

  this.print(str);
  if (opt_onAck)
    opt_onAck();
};

/**
 * Called by hterm.Terminal.IO for keyboard events.
 *
 * We just forward them on to the default command.
 */
wash.TerminalWindow.prototype.onSendString_ = function(str) {
  if (this.executeContext.isReadyState('READY')) {
    var interruptChar = this.executeContext.getTTY().interrupt;
    if (interruptChar && str == interruptChar) {
      console.log('interrupt');
      wam.async(function() {
          this.executeContext.signal('wam.FileSystem.Signal.Interrupt');
        }, [this]);
    } else {
      wam.async(function() { this.executeContext.stdin(str) }, [this]);
    }
  } else {
    console.warn('Execute not ready, ignoring input: ' + str);
  }
};

/**
 * Called by hterm.Terminal.IO when the terminal size changes.
 *
 * We just forward them on to the default command.
 */
wash.TerminalWindow.prototype.onTerminalResize_ = function(columns, rows) {
  if (this.executeContext && this.executeContext.isReadyState('READY'))
    this.executeContext.setTTY({columns: columns, rows: rows});
};

/**
 * Our own keyboard accelerators.
 */
wash.TerminalWindow.prototype.onKeyDown_ = function(e) {
  if (e.ctrlKey && e.shiftKey && e.keyCode == ('R').charCodeAt())
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
