// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * A binding that represents a running executable on a wam.binding.fs.
 * FileSystem.
 *
 * You should only create an ExecuteContext by calling an instance of
 * wam.binding.fs.FileSystem..createExecuteContext().
 *
 * @param {wam.binding.fs.FileSystem} The parent file system.
 */
wam.binding.fs.ExecuteContext = function(fileSystem) {
  // We're a 'subclass' of wam.binding.Ready.
  wam.binding.Ready.call(this);

  /**
   * Parent file system.
   */
  this.fileSystem = fileSystem;

  // If the parent file system is closed, we close too.
  this.dependsOn(this.fileSystem);

  /**
   * The wam.binding.fs.ExecuteContext we're currently calling out to, if any.
   *
   * See ..setCallee().
   */
  this.callee = null;

  /**
   * Called by the execute() method of this instance.
   */
  this.onExecute = new wam.Event(function() {
      this.didExecute_ = true;
    }.bind(this));

  /**
   * Events sourced by this binding in addition to the inherited events from
   * wam.binding.Ready.
   *
   * These are raised after the corresponding method is invoked.  For example,
   * wam.binding.fs.signal(...) raises the onSignal event.
   */
  this.onSignal = new wam.Event();
  this.onStdOut = new wam.Event();
  this.onStdErr = new wam.Event();
  this.onStdIn = new wam.Event();
  this.onTTYChange = new wam.Event();
  this.onTTYRequest = new wam.Event();

  // An indication that the execute() method was called.
  this.didExecute_ = false;

  /**
   * The path provided to the execute() method of this ExecuteContext.
   */
  this.path = null;
  /**
   * The arg provided to the execute() method of this ExecuteContext.
   */
  this.arg = null;

  // The environment variables for this execute context.
  this.env_ = {};

  // The tty state for this execute context.
  this.tty_ = {
    isatty: false,
    rows: 0,
    columns: 0,
    interrupt: String.fromCharCode('C'.charCodeAt(0) - 64)  // ^C
  };
};

wam.binding.fs.ExecuteContext.prototype = Object.create(
    wam.binding.Ready.prototype);

/**
 * Set the given ExecuteContext as the callee for this instance.
 *
 * When calling another executable, incoming calls and outbound events are
 * wired up to the caller as appropriate.  This instance will not receive
 * the stdio-like events while a call is in progress.  The onSignal event,
 * however, is delivered to this instance even when a call is in progress.
 *
 * If the callee is closed, events are rerouted back to this instance and the
 * callee instance property is set to null.
 */
wam.binding.fs.ExecuteContext.prototype.setCallee = function(executeContext) {
  if (this.callee)
    throw new Error('Still waiting for call:', this.callee);

  this.callee = executeContext;
  var previousInterruptChar = this.tty_.interrupt;

  var onClose = function() {
    this.callee.onClose.removeListener(onClose);
    this.callee.onStdOut.removeListener(this.onStdOut);
    this.callee.onStdOut.removeListener(this.onStdErr);
    this.callee.onTTYRequest.removeListener(this.onTTYRequest);
    this.callee = null;

    if (this.tty_.interrupt != previousInterruptChar)
      this.requestTTY({interrupt: previousInterruptChar});
  }.bind(this);

  this.callee.onClose.addListener(onClose);
  this.callee.onStdOut.addListener(this.onStdOut);
  this.callee.onStdErr.addListener(this.onStdErr);
  this.callee.onTTYRequest.addListener(this.onTTYRequest);
  this.callee.setEnvs(this.env_);
  this.callee.setTTY(this.tty_);
};

/**
 * Utility method to construct a new ExecuteContext, set it as the callee, and
 * execute it with the given path and arg.
 */
wam.binding.fs.ExecuteContext.prototype.call = function(path, arg) {
  this.setCallee(this.fileSystem.createExecuteContext());
  this.callee.execute(path, arg);
  return this.callee;
};

/**
 * Return a copy of the internal tty state.
 */
wam.binding.fs.ExecuteContext.prototype.getTTY = function() {
  var rv = {};
  for (var key in this.tty_) {
    rv[key] = this.tty_[key];
  }

  return rv;
};

/**
 * Set the authoritative state of the tty.
 *
 * This should only be invoked in the direction of tty->executable.  Calls in
 * the reverse direction will only affect this instance and those derived (via
 * setCallee) from it, and will be overwritten the next time the authoritative
 * state changes.
 *
 * Executables should use requestTTY to request changes to the authoritative
 * state.
 *
 * The tty state is an object with the following properties:
 *
 *   tty {
 *     isatty: boolean, True if stdio-like methods are attached to a visual
 *       terminal.
 *     rows: integer, The number of rows in the tty.
 *     columns: integer, The number of columns in the tty.
 *     interrupt: string, The key used to raise an
 *       'wam.FileSystem.Error.Interrupt' signal.
 *   }
 *
 * @param {Object} tty An object containing one or more of the properties
 *   described above.
 */
wam.binding.fs.ExecuteContext.prototype.setTTY = function(tty) {
  this.assertReadyState('WAIT', 'READY');

  if ('isatty' in tty)
    this.tty_.isatty = !!tty.isatty;
  if ('rows' in tty)
    this.tty_.rows = tty.rows;
  if ('columns' in tty)
    this.tty_.columns = tty.columns;

  if (!this.tty_.rows || !this.tty_.columns) {
    this.tty_.rows = 0;
    this.tty_.columns = 0;
    this.tty_.isatty = false;
  } else {
    this.tty_.isatty = true;
  }

  if (tty.rows < 0 || tty.columns < 0)
    throw new Error('Invalid tty size.');

  if ('interrupt' in tty)
    this.tty_.interrupt = tty.interrupt;

  this.onTTYChange(this.tty_);

  if (this.callee)
    this.callee.setTTY(tty);
};

/**
 * Request a change to the controlling tty.
 *
 * At the moment only the 'interrupt' property can be changed.
 *
 * @param {Object} tty An object containing a changeable property of the
 *  tty.
 */
wam.binding.fs.ExecuteContext.prototype.requestTTY = function(tty) {
  this.assertReadyState('READY');

  if (typeof tty.interrupt == 'string')
    this.onTTYRequest({interrupt: tty.interrupt});
};

/**
 * Get a copy of the current environment variables.
 */
wam.binding.fs.ExecuteContext.prototype.getEnvs = function() {
  var rv = {};
  for (var key in this.env_) {
    rv[key] = this.env_[key];
  }

  return rv;
};

/**
 * Get the value of the given environment variable, or the provided
 * defaultValue if it is not set.
 *
 * @param {string} name
 * @param {*} defaultValue
 */
wam.binding.fs.ExecuteContext.prototype.getEnv = function(name, defaultValue) {
  if (this.env_.hasOwnProperty(name))
    return this.env_[name];

  return defaultValue;
};

/**
 * Overwrite the current environment.
 *
 * @param {Object} env
 */
wam.binding.fs.ExecuteContext.prototype.setEnvs = function(env) {
  this.assertReadyState('WAIT', 'READY');
  for (var key in env) {
    this.env_[key] = env[key];
  }
};

/**
 * Set the given environment variable.
 *
 * @param {string} name
 * @param {*} value
 */
wam.binding.fs.ExecuteContext.prototype.setEnv = function(name, value) {
  this.assertReadyState('WAIT', 'READY');
  this.env_[name] = value;
};

/**
 * Create a new open context using the wam.binding.fs.FileSystem for this
 * execute context, bound to the lifetime of this context.
 */
wam.binding.fs.ExecuteContext.prototype.createOpenContext = function() {
  var ocx = this.fileSystem.createOpenContext();
  ocx.dependsOn(this);
  return ocx;
};

/**
 * Same as wam.binding.fs.copyFile, except bound to the lifetime of this
 * ExecuteContext.
 */
wam.binding.fs.ExecuteContext.prototype.copyFile = function(
    sourcePath, targetPath, onSuccess, onError) {
  this.readFile(
      sourcePath, {}, {},
      function(result) {
        this.writeFile(
            targetPath,
            {mode: {create: true, truncate: true}},
            {dataType: result.dataType, data: result.data},
            onSuccess,
            onError);
      }.bind(this),
      onError);
};

/**
 * Same as wam.binding.fs.readFile, except bound to the lifetime of this
 * ExecuteContext.
 */
wam.binding.fs.ExecuteContext.prototype.readFile = function(
    path, openArg, readArg, onSuccess, onError) {
  var ocx = this.fileSystem.readFile(
      path, openArg, readArg, onSuccess, onError);
  ocx.dependsOn(this);
  return ocx;
};

/**
 * Same as wam.binding.fs.writeFile, except bound to the lifetime of this
 * ExecuteContext.
 */
wam.binding.fs.ExecuteContext.prototype.writeFile = function(
    path, openArg, writeArg, onSuccess, onError) {
  var ocx = this.fileSystem.writeFile(
      path, openArg, writeArg, onSuccess, onError);
  ocx.dependsOn(this);
  return ocx;
};

/**
 * Attempt to execute the given path with the given argument.
 *
 * This can only be called once per OpenContext instance.
 *
 * This function attempts to execute a path.  If the execute succeeds, the
 * onReady event of this binding will fire and you're free to start
 * communicating with the target process.
 *
 * When you're finished, call closeOk, closeError, or closeErrorValue to clean
 * up the execution context.
 *
 * If the execute fails the context will be close with an 'error' reason.
 *
 * The onClose event of this binding will fire when the context is closed,
 * regardless of which side of the context initiated the close.
 *
 * @param {string} The path to execute.
 * @param {*} The arg to pass to the executable.
 */
wam.binding.fs.ExecuteContext.prototype.execute = function(path, arg) {
  this.assertReadyState('WAIT');

  if (this.didExecute_)
    throw new Error('Already executed on this context');

  this.path = path;
  this.arg = arg;

  this.onExecute();
};

/**
 * Send a signal to the running executable.
 *
 * The only signal defined at this time has the name 'wam.FileSystem.Signal.
 * Interrupt' and a null value.
 *
 * @param {name}
 * @param {value}
 */
wam.binding.fs.ExecuteContext.prototype.signal = function(name, value) {
  this.assertReady();
  if (this.callee) {
    this.callee.closeError('wam.FileSystem.Error.Interrupt', []);
  } else {
    this.onSignal(name, value);
  }
};

/**
 * Send stdout from this executable.
 *
 * This is not restricted to string values.  Recipients should filter out
 * non-string values in their onStdOut handler if necessary.
 *
 * TODO(rginda): Add numeric argument onAck to support partial consumption.
 *
 * @param {*} value The value to send.
 * @param {function()} opt_onAck The optional function to invoke when the
 *   recipient acknowledges receipt.
 */
wam.binding.fs.ExecuteContext.prototype.stdout = function(value, opt_onAck) {
  if (!this.isReadyState('READY')) {
    console.warn('Dropping stdout to closed execute context:', value);
    return;
  }

  this.onStdOut(value, opt_onAck);
};

/**
 * Send stderr from this executable.
 *
 * This is not restricted to string values.  Recipients should filter out
 * non-string values in their onStdErr handler if necessary.
 *
 * TODO(rginda): Add numeric argument onAck to support partial consumption.
 *
 * @param {*} value The value to send.
 * @param {function()} opt_onAck The optional function to invoke when the
 *   recipient acknowledges receipt.
 */
wam.binding.fs.ExecuteContext.prototype.stderr = function(value, opt_onAck) {
  if (!this.isReadyState('READY')) {
    console.warn('Dropping stderr to closed execute context:', value);
    return;
  }

  this.onStdErr(value, opt_onAck);
};

/**
 * Send stdout to this executable.
 *
 * This is not restricted to string values.  Recipients should filter out
 * non-string values in their onStdIn handler if necessary.
 *
 * TODO(rginda): Add opt_onAck.
 *
 * @param {*} value The value to send.
 */
wam.binding.fs.ExecuteContext.prototype.stdin = function(value) {
  this.assertReady();
  if (this.callee) {
    this.callee.stdin(value);
  } else {
    this.onStdIn(value);
  }
};
