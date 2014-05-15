// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.jsfs.OpenContext = function(jsfsFileSystem, openContextBinding) {
  this.jsfsFileSystem = jsfsFileSystem;
  this.openContextBinding = openContextBinding;
  openContextBinding.onOpen.addListener(this.onOpen_, this);
};

wam.jsfs.OpenContext.prototype.onOpen_ = function() {
  var path = this.openContextBinding.path;

  var onError = function(value) {
    this.openContextBinding.closeErrorValue(value);
  }.bind(this);

  var onPartialResolve = function(prefixList, pathList, entry) {
    if (entry.can('FORWARD')) {
      entry.forwardOpen
      ({openContext: this.openContextBinding,
        forwardPath: pathList.join('/')});
      return;
    }

    if (pathList.length) {
      onError(wam.mkerr('wam.FileSystem.Error.NotFound', [path]));
      return;
    }

    if (!entry.can('OPEN')) {
      onError(wam.mkerr('wam.FileSystem.Error.NotOpenable', [path]));
      return;
    }

    entry.open(this.openContextBinding, this);
  }.bind(this);

  this.jsfsFileSystem.partialResolve(path, onPartialResolve, onError);
};
