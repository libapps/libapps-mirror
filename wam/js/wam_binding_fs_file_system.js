// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.binding.fs.FileSystem = function() {
  wam.binding.Ready.call(this);

  this.onStat = new wam.Event();
  this.onList = new wam.Event();
  this.onExecuteContextCreated = new wam.Event();
};

wam.binding.fs.FileSystem.prototype = Object.create(
    wam.binding.Ready.prototype);

wam.binding.fs.FileSystem.prototype.stat = function(arg, onSuccess, onError) {
  this.assertReady();
  this.onStat({path: arg.path}, onSuccess, onError);
};

wam.binding.fs.FileSystem.prototype.list = function(arg, onSuccess, onError) {
  this.assertReady();
  this.onList({path: arg.path}, onSuccess, onError);
};

wam.binding.fs.FileSystem.prototype.createExecuteContext = function() {
  this.assertReady();
  var executeContext = new wam.binding.fs.ExecuteContext(this);
  executeContext.dependsOn(this);
  this.onExecuteContextCreated(executeContext);
  return executeContext;
};
