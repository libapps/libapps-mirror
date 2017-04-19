// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * This is nassh as a lib.wam.fs.Executable.
 *
 * It's connected to the nassh filesystem in nassh_commands.js.
 */
nassh.Nassh = function(executeContext) {
  this.executeContext = executeContext;
  this.executeContext.onStdIn.addListener(this.onStdIn_, this);
  this.executeContext.onTTYChange.addListener(this.onTTYChange_, this);
  this.executeContext.onClose.addListener(this.onExecuteClose_, this);

  executeContext.ready();
  executeContext.requestTTY({interrupt: ''});

  var ecArg = executeContext.arg;

  if (ecArg instanceof Array) {
    ecArg = {argv: ecArg};
  } else if (!(ecArg instanceof Object)) {
    executeContext.closeError('wam.FileSystem.Error.UnexpectedArgvType',
                              ['object']);
    return;
  }

  /**
   * The argv object to pass to the NaCl plugin.
   */
  this.argv = {};

  if (ecArg.argv instanceof Array) {
    this.argv.arguments = [].concat(ecArg.argv);
  } else {
    this.argv.arguments = [];
  }

  this.argv.environment = this.executeContext.getEnvs();

  var tty = executeContext.getTTY();
  this.argv.terminalWidth = tty.columns;
  this.argv.terminalHeight = tty.rows;
  this.argv.writeWindow = 8 * 1024;

  this.plugin_ = null;

  // Counters used to acknowledge writes from the plugin.
  this.stdoutAcknowledgeCount_ = 0;
  this.stderrAcknowledgeCount_ = 0;

  this.onInit = new lib.Event();
  this.initPlugin_(this.onInit);
};

/**
 * Invoked from nassh.Commands.on['nassh'].
 *
 * This is the entrypoint when invoked as an executable.
 */
nassh.Nassh.main = function(executeContext) {
  var session = new nassh.Nassh(executeContext);
  session.onInit.addListener(session.start.bind(session));
};

/**
 * File descriptors used when talking to the plugin about stdio.
 */
nassh.Nassh.STDIN = 0;
nassh.Nassh.STDOUT = 1;
nassh.Nassh.STDERR = 2;

/**
 * Perform final cleanup when it's time to exit this nassh session.
 */
nassh.Nassh.prototype.exit = function(name, arg) {
  if (this.plugin_) {
    this.plugin_.parentNode.removeChild(this.plugin_);
    this.plugin_ = null;
  }
};

/**
 * Tell the NaCl plugin it's time to start.
 */
nassh.Nassh.prototype.start = function() {
  this.sendToPlugin_('startSession', [this.argv]);
};

nassh.Nassh.prototype.print = function(str, opt_onAck) {
  this.executeContext.stdout(str, opt_onAck);
};

nassh.Nassh.prototype.println = function(str, opt_onAck) {
  this.executeContext.stdout(str + '\n');
};

nassh.Nassh.prototype.initPlugin_ = function(onComplete) {
  this.print(nassh.msg('PLUGIN_LOADING'));

  this.plugin_ = window.document.createElement('embed');
  this.plugin_.setAttribute('src', '../plugin/pnacl/ssh_client.nmf');
  this.plugin_.setAttribute('type', 'application/x-nacl');

  this.plugin_.addEventListener('load', () => {
    this.println(nassh.msg('PLUGIN_LOADING_COMPLETE'));
    setTimeout(this.onTTYChange_.bind(this));
    onComplete();
  });

  this.plugin_.addEventListener('message', (e) => {
    var msg = JSON.parse(e.data);
    msg.argv = msg.arguments;

    if (msg.name in this.onPlugin_) {
      this.onPlugin_[msg.name].apply(this, msg.arguments);
    } else {
      console.log('Unknown message from plugin: ' + JSON.stringify(msg));
    }
  });

  this.plugin_.addEventListener('crash', (e) => {
    console.log('plugin crashed');
    this.executeContext.closeError('wam.FileSystem.Error.PluginCrash',
                                   [this.plugin_.exitStatus]);
  });

  document.body.insertBefore(this.plugin_, document.body.firstChild);

  // Set mimetype twice for https://crbug.com/371059
  this.plugin_.setAttribute('type', 'application/x-nacl');
};

/**
 * Send a message to the nassh plugin.
 *
 * @param {string} name The name of the message to send.
 * @param {Array} arguments The message arguments.
 */
nassh.Nassh.prototype.sendToPlugin_ = function(name, args) {
  var str = JSON.stringify({name: name, arguments: args});

  this.plugin_.postMessage(str);
};

nassh.Nassh.prototype.onExecuteClose_ = function(reason, value) {
  if (this.plugin_) {
    this.plugin_.parentNode.removeChild(this.plugin_);
    this.plugin_ = null;
  }
};

/**
 * Hooked up to the onInput event of the message that started nassh.
 */
nassh.Nassh.prototype.onStdIn_ = function(value) {
  if (typeof value != 'string')
    return;

  this.sendToPlugin_('onRead', [nassh.Nassh.STDIN, btoa(value)]);
};

nassh.Nassh.prototype.onTTYChange_ = function() {
  var tty = this.executeContext.getTTY();
  this.sendToPlugin_('onResize', [Number(tty.columns), Number(tty.rows)]);
};

/**
 * Plugin message handlers.
 */
nassh.Nassh.prototype.onPlugin_ = {};

/**
 * Log a message from the plugin.
 */
nassh.Nassh.prototype.onPlugin_.printLog = function(str) {
  console.log('plugin log: ' + str);
};

/**
 * Plugin has exited.
 */
nassh.Nassh.prototype.onPlugin_.exit = function(code) {
  console.log('plugin exit: ' + code);
  this.sendToPlugin_('onExitAcknowledge', []);
  this.executeContext.closeOk(code);
};

/**
 * Plugin wants to write some data to a file descriptor.
 *
 * This is only used for stdout/stderr.  It used to be used as a conduit to
 * the HTML5 filesystem, but now NaCl can get there directly.
 */
nassh.Nassh.prototype.onPlugin_.write = function(fd, data) {
  if (fd != nassh.Nassh.STDOUT && fd != nassh.Nassh.STDERR) {
    console.warn('Attempt to write to unknown fd: ' + fd);
    return;
  }

  var string = atob(data);
  this.print(string, () => {
    var ackCount = (fd == nassh.Nassh.STDOUT ?
                    this.stdoutAcknowledgeCount_ += string.length :
                    this.stderrAcknowledgeCount_ += string.length);
    if (this.plugin_) {
      // After exit, the last ack comes after the plugin has been destroyed.
      this.sendToPlugin_('onWriteAcknowledge', [fd, ackCount]);
    }
  });
};

/**
 * Plugin wants to read from a file descriptor.
 *
 * This isn't necessary any more, though the NaCl plugin does seem to call it
 * a few times at startup with fd=0, size=1.  It can be safely ignored in
 * those cases.
 */
nassh.Nassh.prototype.onPlugin_.read = function(fd, size) {
  if (fd == nassh.Nassh.STDIN && size == 1)
    return;

  console.warn('Plugin send unexpected "read" message: ' + fd + ', ' + size);
};
