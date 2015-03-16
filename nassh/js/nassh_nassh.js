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
  // TODO(binji): some way to specify whether TTY should share input/output
  // with stdin/stdout. We only want to separate the two when piping SSH output
  // (e.g. scp)
  this.streamManager_ = new nassh.StreamManager();
  this.inputBuffer_ = new nassh.InputBuffer();
  this.ttyInputBuffer_ = new nassh.InputBuffer();

  this.executeContext = executeContext;
  this.executeContext.stdin.onData.addListener(this.onStdIn_, this);
  this.executeContext.ttyin.onData.addListener(this.onTTYIn_, this);
  this.executeContext.onTTYChange.addListener(this.onTTYChange_, this);
  this.executeContext.onClose.addListener(this.onExecuteClose_, this);

  executeContext.ready();
  executeContext.requestTTY({interrupt: ''});

  var ecArg = executeContext.args.arg;

  if (ecArg instanceof Array) {
    ecArg = {argv: ecArg};
  } else if (!(ecArg instanceof Object)) {
    executeContext.closeError(new axiom.core.error.AxiomError.TypeMismatch(
        'argv: Expected Array or Object', typeof ecArg));
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

  var washEnv = this.executeContext.getEnvs();
  this.argv.environment = {};
  for (var key in washEnv) {
    if (key.substr(0, 1) == '$')
      this.argv.environment[key.substr(1)] = washEnv[key];
  }

  var tty = executeContext.getTTY();
  this.argv.terminalWidth = tty.columns;
  this.argv.terminalHeight = tty.rows;
  this.argv.writeWindow = 8 * 1024;

  this.plugin_ = null;

  this.onInit = new lib.Event();
  this.initPlugin_(this.onInit);
};

/**
 * Paths that can be opened by the plugin.
 */
nassh.Nassh.DEV_TTY = '/dev/tty';
nassh.Nassh.DEV_STDIN = '/dev/stdin';
nassh.Nassh.DEV_STDOUT = '/dev/stdout';
nassh.Nassh.DEV_STDERR = '/dev/stderr';

/**
 * Invoked from nassh.Commands.on['nassh'].
 *
 * This is the entrypoint when invoked as an executable.
 */
nassh.Nassh.main = function(executeContext) {
  var session = new nassh.Nassh(executeContext);
  session.onInit.addListener(session.start.bind(session));
  return executeContext.ephemeralPromise;
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
  // TODO(binji): is this not called?
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
  this.executeContext.stderr.write(str, opt_onAck);
};

nassh.Nassh.prototype.println = function(str, opt_onAck) {
  this.executeContext.stderr.write(str + '\n');
};

nassh.Nassh.prototype.initPlugin_ = function(onComplete) {
  this.print(nassh.msg('PLUGIN_LOADING'));

  this.plugin_ = window.document.createElement('embed');
  this.plugin_.setAttribute('src', '../plugin/pnacl/ssh_client.nmf');
  this.plugin_.setAttribute('type', 'application/x-nacl');

  this.plugin_.addEventListener('load', function() {
    this.println(nassh.msg('PLUGIN_LOADING_COMPLETE'));
    this.executeContext.stdin.resume();
    this.executeContext.ttyin.resume();
    setTimeout(this.onTTYChange_.bind(this));
    onComplete();
  }.bind(this));

  this.plugin_.addEventListener('message', function(e) {
    var msg = JSON.parse(e.data);
    msg.argv = msg.arguments;

    if (msg.name in this.onPlugin_) {
      this.onPlugin_[msg.name].apply(this, msg.arguments);
    } else {
      console.log('Unknown message from plugin: ' + JSON.stringify(msg));
    }
  }.bind(this));

  this.plugin_.addEventListener('crash', function(e) {
    console.log('plugin crashed');
    this.executeContext.closeError('wam.FileSystem.Error.PluginCrash',
                                   [this.plugin_.exitStatus]);
  }.bind(this));

  document.body.insertBefore(this.plugin_, document.body.firstChild);

  // Set mimetype twice for http://crbug.com/371059
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

  if (this.plugin_)
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

  this.inputBuffer_.write(value);
};

/**
 * Hooked up to the onInput event of the message that started nassh.
 */
nassh.Nassh.prototype.onTTYIn_ = function(value) {
  if (typeof value != 'string')
    return;

  this.ttyInputBuffer_.write(value);
};

nassh.Nassh.prototype.onTTYChange_ = function() {
  if (!this.plugin_)
    return;

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
  this.executeContext.requestTTY({interrupt: null});
  this.executeContext.closeOk(code);
};

/**
 * Helper function to create a TTY stream.
 *
 * @param {integer} fd The file descriptor index.
 * @param {boolean} allowRead True if this stream can be read from.
 * @param {boolean} allowWrite True if this stream can be written to.
 * @param {function} onOpen Callback to call when the stream is opened.
 *
 * @return {Object} The newly created stream.
 */
nassh.Nassh.prototype.createTtyStream = function(
    fd, path, allowRead, allowWrite, onOpen) {
  var cx = this.executeContext;
  var arg = {
    fd: fd,
    allowRead: allowRead,
    allowWrite: allowWrite,
  };

  if (path == nassh.Nassh.DEV_TTY) {
    arg.inputBuffer = this.ttyInputBuffer_;
    arg.onWrite = cx.ttyout.write.bind(cx.ttyout);
  } else if (path == nassh.Nassh.DEV_STDIN) {
    arg.inputBuffer = this.inputBuffer_;
  } else if (path == nassh.Nassh.DEV_STDOUT) {
    arg.onWrite = cx.stdout.write.bind(cx.stdout);
  } else if (path == nassh.Nassh.DEV_STDERR) {
    arg.onWrite = cx.stderr.write.bind(cx.stderr);
  }

  var streamClass = nassh.Stream.Tty;
  var stream = this.streamManager_.openStream(streamClass, fd, arg, onOpen);
  if (allowRead) {
    var onDataAvailable = function(isAvailable) {
      // Send current read status to plugin.
      setTimeout(function() {
        this.sendToPlugin_('onReadReady', [fd, isAvailable]);
      }.bind(this), 0);
    }.bind(this);

    arg.inputBuffer.onDataAvailable.addListener(onDataAvailable);

    stream.onClose = function(reason) {
      arg.inputBuffer.onDataAvailable.removeListener(onDataAvailable);
      this.sendToPlugin_('onClose', [fd, reason]);
    }.bind(this);
  }

  return stream;
};

/**
 * Plugin wants to open a file.
 *
 * The only supported paths are /dev/stdin, /dev/stdout, /dev/stderr and
 * /dev/tty.
 */
nassh.Nassh.prototype.onPlugin_.openFile = function(fd, path, mode) {
  // TODO(binji): this should be determined as being whether stdin/stdout are
  // being piped.
  var isAtty =
      !(path == nassh.Nassh.DEV_STDIN || path == nassh.Nassh.DEV_STDOUT);

  if (path == nassh.Nassh.DEV_TTY || path == nassh.Nassh.DEV_STDIN ||
      path == nassh.Nassh.DEV_STDOUT || path == nassh.Nassh.DEV_STDERR) {
    var allowRead =
        path == nassh.Nassh.DEV_STDIN || path == nassh.Nassh.DEV_TTY;
    var allowWrite = path == nassh.Nassh.DEV_STDOUT ||
                     path == nassh.Nassh.DEV_STDERR ||
                     path == nassh.Nassh.DEV_TTY;
    var stream = this.createTtyStream(
        fd, path, allowRead, allowWrite, function(success) {
          this.sendToPlugin_('onOpenFile', [fd, success, isAtty]);
        }.bind(this));
  } else {
    this.sendToPlugin_('onOpenFile', [fd, false, false]);
  }
};

/**
 * Plugin wants to write some data to a file descriptor.
 */
nassh.Nassh.prototype.onPlugin_.write = function(fd, data) {
  var stream = this.streamManager_.getStreamByFd(fd);

  if (!stream) {
    console.warn('Attempt to write to unknown fd: ' + fd);
    return;
  }

  stream.asyncWrite(data, function(writeCount) {
      this.sendToPlugin_('onWriteAcknowledge', [fd, writeCount]);
    }.bind(this), 100);
};

/**
 * Plugin wants to read from a file descriptor.
 */
nassh.Nassh.prototype.onPlugin_.read = function(fd, size) {
  var stream = this.streamManager_.getStreamByFd(fd);

  if (!stream) {
    console.warn('Attempt to read from unknown fd: ' + fd);
    return;
  }

  stream.asyncRead(size, function(b64bytes) {
      this.sendToPlugin_('onRead', [fd, b64bytes]);
    }.bind(this));
};

/**
 * Plugin wants to close a file descriptor.
 */
nassh.Nassh.prototype.onPlugin_.close = function(fd) {
  var stream = this.streamManager_.getStreamByFd(fd);
  if (!stream) {
    console.warn('Attempt to close unknown fd: ' + fd);
    return;
  }

  stream.close();
};
