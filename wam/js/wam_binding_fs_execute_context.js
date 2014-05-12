// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.binding.fs.ExecuteContext = function(fileSystem, opt_parentContext) {
  wam.binding.Ready.call(this);

  this.fileSystem = fileSystem;
  this.dependsOn(this.fileSystem);

  this.callee = null;

  this.parentContext = opt_parentContext || null;

  this.onExecute = new wam.Event(function() {
      this.didExecute = true;
    }.bind(this));

  this.onSignal = new wam.Event();
  this.onStdOut = new wam.Event();
  this.onStdErr = new wam.Event();
  this.onStdIn = new wam.Event();
  this.onTTYChange = new wam.Event();
  this.onTTYRequest = new wam.Event();

  this.didExecute = false;

  this.path = null;
  this.arg = null;

  this.env_ = {};
  this.tty_ = {
    isatty: false,
    rows: 0,
    columns: 0,
    interrupt: String.fromCharCode('C'.charCodeAt(0) - 64)
  };
};

wam.binding.fs.ExecuteContext.prototype = Object.create(
    wam.binding.Ready.prototype);

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

wam.binding.fs.ExecuteContext.prototype.call = function(path, args) {
  this.setCallee(this.fileSystem.createExecuteContext());
  this.callee.execute(path, args);
  return this.callee;
};

wam.binding.fs.ExecuteContext.prototype.getTTY = function() {
  var rv = {};
  for (var key in this.tty_) {
    rv[key] = this.tty_[key];
  }

  return rv;
};

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

wam.binding.fs.ExecuteContext.prototype.requestTTY = function(tty) {
  this.assertReadyState('READY');

  if (typeof tty.interrupt == 'string')
    this.onTTYRequest({interrupt: tty.interrupt});
};

wam.binding.fs.ExecuteContext.prototype.getEnvs = function() {
  var rv = {};
  for (var key in this.env_) {
    rv[key] = this.env_[key];
  }

  return rv;
};

wam.binding.fs.ExecuteContext.prototype.getEnv = function(name, defaultValue) {
  if (this.env_.hasOwnProperty(name))
    return this.env_[name];

  return defaultValue;
};

wam.binding.fs.ExecuteContext.prototype.setEnvs = function(env) {
  this.assertReadyState('WAIT', 'READY');
  for (var key in env) {
    this.env_[key] = env[key];
  }
};

wam.binding.fs.ExecuteContext.prototype.setEnv = function(name, value) {
  this.assertReadyState('WAIT', 'READY');
  this.env_[name] = value;
};

wam.binding.fs.ExecuteContext.prototype.execute = function(path, arg) {
  this.assertReadyState('WAIT');

  if (this.didExecute)
    throw new Error('Already executed on this context');

  this.path = path;
  this.arg = arg;

  this.onExecute();
};

wam.binding.fs.ExecuteContext.prototype.signal = function(name, value) {
  this.assertReady();
  if (this.callee) {
    this.callee.closeError('wam.FileSystem.Error.Interrupt', []);
  } else {
    this.onSignal(name, value);
  }
};

wam.binding.fs.ExecuteContext.prototype.stdout = function(value, opt_onAck) {
  this.assertReady();
  this.onStdOut(value, opt_onAck);
};

wam.binding.fs.ExecuteContext.prototype.stderr = function(value, opt_onAck) {
  this.assertReady();
  this.onStdErr(value, opt_onAck);
};

wam.binding.fs.ExecuteContext.prototype.stdin = function(value) {
  this.assertReady();
  if (this.callee) {
    this.callee.stdin(value);
  } else {
    this.onStdIn(value);
  }
};
