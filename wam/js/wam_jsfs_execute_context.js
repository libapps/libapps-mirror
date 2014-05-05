// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.jsfs.ExecuteContext = function(jsfsFileSystem, executeContextBinding) {
  this.jsfsFileSystem = jsfsFileSystem;
  this.executeContextBinding = executeContextBinding;
  executeContextBinding.onExecute.addListener(this.onExecute_, this);
};

wam.jsfs.ExecuteContext.prototype.onExecute_ = function() {
  var path = this.executeContextBinding.path;

  var onError = function(value) {
    this.executeContextBinding.closeErrorValue(value);
  }.bind(this);

  var onResolve = function(entry) {
    if (!entry.can('EXECUTE')) {
      this.executeContextBinding.closeError(
          'wam.FileSystem.Error.NotExecutable', [path]);
      return;
    }

    entry.execute(this.executeContextBinding, this);
  }.bind(this);

  this.jsfsFileSystem.resolve(path, onResolve, onError);
};
