// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

nassh.executables = {};

nassh.executables.install = function(jsfs, path, onSuccess, onError) {
  var exes = {};
  for (var key in nassh.executables.callbacks) {
    var callback = nassh.executables.callbacks[key];
    exes[key] = new wam.jsfs.Executable(callback);
  }

  jsfs.makeEntries(path, exes, onSuccess, onError);
};

nassh.executables.callbacks = {};

/**
 * The list of callbacks for the executables.
 *
 * See the comments in wash/js/wash_commands.js for some details.
 */
nassh.executables.callbacks = {};

nassh.executables.callbacks['nassh'] = function(executeContext) {
  nassh.Nassh.main(executeContext);
};
