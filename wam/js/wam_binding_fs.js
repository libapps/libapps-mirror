// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Namespace for bindings related to wam.FileSystem.
 */
wam.binding.fs = {};

wam.errorManager.defineErrors
(
 ['wam.FileSystem.Error.BadOrMissingArgument', ['name', 'expected']],
 ['wam.FileSystem.Error.BeginningOfFile', []],
 ['wam.FileSystem.Error.EndOfFile', []],
 ['wam.FileSystem.Error.UnexpectedArgvType', ['expected']],
 ['wam.FileSystem.Error.Interrupt', []],
 ['wam.FileSystem.Error.InvalidPath', ['path']],
 ['wam.FileSystem.Error.NotFound', ['path']],
 ['wam.FileSystem.Error.NotExecutable', ['path']],
 ['wam.FileSystem.Error.NotListable', ['path']],
 ['wam.FileSystem.Error.NotOpenable', ['path']],
 ['wam.FileSystem.Error.OperationTimedOut', []],
 ['wam.FileSystem.Error.OperationNotSupported', []],
 ['wam.FileSystem.Error.PathExists', ['path']],
 ['wam.FileSystem.Error.PermissionDenied', []],
 ['wam.FileSystem.Error.ReadError', ['diagnostic']],
 ['wam.FileSystem.Error.ReadyTimeout', []],
 ['wam.FileSystem.Error.ResultTooLarge', ['maxSize', 'resultSize']],
 ['wam.FileSystem.Error.RuntimeError', ['diagnostic']]
);

wam.binding.fs.baseName = function(path) {
  var lastSlash = path.lastIndexOf('/');
  return path.substr(lastSlash + 1);
};

wam.binding.fs.dirName = function(path) {
  var lastSlash = path.lastIndexOf('/');
  return path.substr(0, lastSlash);
};

wam.binding.fs.absPath = function(pwd, path) {
  if (path.substr(0, 1) != '/')
    path = pwd + path;

  return '/' + wam.binding.fs.normalizePath(path);
};

wam.binding.fs.normalizePath = function(path) {
  return wam.binding.fs.splitPath(path).join('/');
};

wam.binding.fs.splitPath = function(path) {
  var rv = [];
  var ary = path.split(/\//g);
  for (var i = 0; i < ary.length; i++) {
    if (!ary[i] || ary[i] == '.')
      continue;

    if (ary[i] == '..') {
      rv.pop();
    } else {
      rv.push(ary[i]);
    }
  }

  return rv;
};
