// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.transport.Direct = function(name) {
  /**
   * An arbitrary name for this transport used for debugging.
   */
  this.name = name;

  this.readyBinding = new wam.binding.Ready();
  this.readyBinding.onClose.addListener(this.onReadyBindingClose_, this);

  /**
   * Subscribe to this event to peek at inbound messages.
   */
  this.onMessage = new wam.Event(function(msg) {
      if (this.verbose)
        console.log(this.name + ' got: ' + JSON.stringify(msg));
    }.bind(this));

  this.isConnected_ = false;
  this.remoteEnd_ = null;

  this.queue_ = [];
  this.boundServiceMethod_ = this.service_.bind(this);
  this.servicePromise_ = new Promise(function(resolve) { resolve() });
};

wam.transport.Direct.createPair = function(opt_namePrefix) {
  var prefix = opt_namePrefix ? (opt_namePrefix + '-') : '';
  var a = new wam.transport.Direct(prefix + 'a');
  var b = new wam.transport.Direct(prefix + 'b');

  a.remoteEnd_= b;
  b.remoteEnd_ = a;

  a.readyBinding.onClose.addListener(function() {
      setTimeout(function() {
          if (b.readyBinding.isOpen)
            b.readyBinding.closeErrorValue(null);
        }, 0);
    });

  b.readyBinding.onClose.addListener(function() {
      setTimeout(function() {
          if (a.readyBinding.isOpen)
            a.readyBinding.closeErrorValue(null);
        }, 0);
    });

  a.reconnect();

  return [a, b];
};

wam.transport.Direct.prototype.service_ = function() {
  for (var i = 0; i < this.queue_.length; i++) {
    var ary = this.queue_[i];
    var method = ary[0];
    this[method].call(this, ary[1]);
    if (ary[2])
      wam.async(ary[2]);
  }

  this.queue_.length = 0;
};

wam.transport.Direct.prototype.push_ = function(name, args, opt_onSend) {
  if (!this.queue_.length) {
    this.servicePromise_
        .then(this.boundServiceMethod_)
        .catch(function(ex) {
            if ('message' in ex && 'stack' in ex) {
              console.warn(ex.message, ex.stack);
            } else {
              if (lib && lib.TestManager &&
                  ex instanceof lib.TestManager.Result.TestComplete) {
                // Tests throw this non-error when they complete, we don't want
                // to log it.
                return;
              }

              console.warn(ex);
            }
          });
  }

  this.queue_.push([name, args, opt_onSend]);
};

wam.transport.Direct.prototype.reconnect = function() {
  this.readyBinding.reset();
  this.isConnected_ = true;
  this.readyBinding.ready();

  this.remoteEnd_.readyBinding.reset();
  this.remoteEnd_.isConnected_ = true;
  this.remoteEnd_.readyBinding.ready();
};

wam.transport.Direct.prototype.disconnect = function() {
  this.readyBinding.closeOk(null);
};

wam.transport.Direct.prototype.send = function(msg, opt_onSend) {
  if (!this.isConnected_)
    throw new Error('Not connected.');

  this.remoteEnd_.push_('onMessage', msg, opt_onSend);
};

wam.transport.Direct.prototype.onReadyBindingClose_ = function(reason, value) {
  if (!this.isConnected_)
    return;

  this.isConnected_ = false;
};
