// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.binding.Ready = function() {
  this.readyState = wam.binding.Ready.state.WAIT;

  this.isOpen = false;

  this.readyValue = null;
  this.closeReason = null;
  this.closeValue = null;

  this.onReady = new wam.Event(function(value) {
      this.readyValue = value;
      this.readyState = wam.binding.Ready.state.READY;
      this.isOpen = true;
    }.bind(this));

  this.onClose = new wam.Event(function(reason, value) {
      this.closeReason = (reason == 'ok' ? 'ok' : 'error');
      this.closeValue = value;
      this.isOpen = false;

      if (reason == 'ok') {
        this.readyState = wam.binding.Ready.state.CLOSED;
      } else {
        this.readyState = wam.binding.Ready.state.ERROR;
      }
    }.bind(this));
};

wam.binding.Ready.state = {
  WAIT: 'WAIT',
  READY: 'READY',
  ERROR: 'ERROR',
  CLOSED: 'CLOSED'
};

wam.binding.Ready.prototype.isReadyState = function(/* stateName , ... */) {
  for (var i = 0; i < arguments.length; i++) {
    var stateName = arguments[i];
    if (!wam.binding.Ready.state.hasOwnProperty(stateName))
      throw new Error('Unknown state: ' + stateName);

    if (this.readyState == wam.binding.Ready.state[stateName])
      return true;
  }

  return false;
};

wam.binding.Ready.prototype.assertReady = function() {
  if (this.readyState != wam.binding.Ready.state.READY)
    throw new Error('Invalid ready call: ' + this.readyState);
};

wam.binding.Ready.prototype.assertReadyState = function(/* stateName , ... */) {
  if (!this.isReadyState.apply(this, arguments))
    throw new Error('Invalid ready call: ' + this.readyState);
};

wam.binding.Ready.prototype.dependsOn = function(otherReady) {
  otherReady.onClose.addListener(function() {
      if (this.isReadyState('CLOSED', 'ERROR'))
        return;

      this.closeError('wam.Error.ParentClosed',
                      [otherReady.closeReason, otherReady.closeValue]);
    }.bind(this));
};

wam.binding.Ready.prototype.reset = function() {
  this.assertReadyState('WAIT', 'CLOSED', 'ERROR');
  this.readyState = wam.binding.Ready.state['WAIT'];
};

wam.binding.Ready.prototype.ready = function(value) {
  this.assertReadyState('WAIT');
  this.onReady(value);
};

wam.binding.Ready.prototype.closeOk = function(value) {
  this.assertReadyState('READY');
  this.onClose('ok', value);
};

wam.binding.Ready.prototype.closeErrorValue = function(value) {
  this.assertReadyState('READY', 'WAIT');
  this.onClose('error', value);
};

wam.binding.Ready.prototype.closeError = function(name, arg) {
  this.closeErrorValue(wam.mkerr(name, arg));
};
