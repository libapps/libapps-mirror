// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

// Chrome-specific wash executables.

wash.executables.chrome = {};

wash.executables.chrome.install = function(jsfs, path, onSuccess, onError) {
  var exes = {};
  for (var key in wash.executables.chrome.callbacks) {
    var callback = wash.executables.chrome.callbacks[key];
    exes[key] = new wam.jsfs.Executable(callback.bind(null, jsfs));
  }

  jsfs.makeEntries(path, exes, onSuccess, onError);
};

wash.executables.chrome.callbacks = {};

wash.executables.chrome.callbacks['mount.chrome'] = function(
    jsfs, executeContext) {
  executeContext.ready();
  var arg = executeContext.arg || {};

  if (!arg instanceof Object) {
    executeContext.closeError('wam.FileSystem.Error.UnexpectedArgvType',
                              ['object']);
    return;
  }

  var id = arg.id;
  if (!id || typeof id != 'string') {
    executeContext.closeError('wam.FileSystem.Error.BadOrMissingArgument',
                              ['id', 'string']);
    return;
  }

  var path = arg.path;
  if (path && typeof path != 'string') {
    executeContext.closeError('wam.FileSystem.Error.BadOrMissingArgument',
                              ['id', 'string']);
    return;
  }

  var rfs = null;

  var onFileSystemReady = function() {
    rfs.onReady.removeListener(onFileSystemReady);
    rfs.onClose.removeListener(onFileSystemClose);

    if (!path)
      path = '/apps/' + (rfs.remoteName || id);

    jsfs.makeEntry(
        path, rfs,
        function() {
          executeContext.closeOk(null);
        },
        function(value) {
          transport.disconnect();
          executeContext.closeErrorValue(value);
        });
  };

  var onFileSystemClose = function(value) {
    rfs.onReady.removeListener(onFileSystemReady);
    rfs.onClose.removeListener(onFileSystemClose);

    executeContext.closeError(value);
  };

  var onTransportClose = function(reason, value) {
    transport.readyBinding.onClose.removeListener(onTransportClose);
    transport.readyBinding.onReady.removeListener(onTransportReady);

    if (executeContext.isOpen) {
      executeContext.closeError('wam.FileSystem.Error.RuntimeError',
                                ['Transport connection failed.']);
      return;
    }
  };

  var onTransportReady = function(reason, value) {
    transport.readyBinding.onClose.removeListener(onTransportClose);
    transport.readyBinding.onReady.removeListener(onTransportReady);

    var channel = new wam.Channel(transport, 'crx:' + id);
    //channel.verbose = wam.Channel.verbosity.ALL;
    rfs = new wam.jsfs.RemoteFileSystem(channel);
    rfs.onReady.addListener(onFileSystemReady);
    rfs.onClose.addListener(onFileSystemClose);
 };

  var transport = new wam.transport.ChromePort();
  transport.readyBinding.onClose.addListener(onTransportClose);
  transport.readyBinding.onReady.addListener(onTransportReady);
  transport.connect(id);
};

wash.executables.chrome.callbacks['nacl'] = function(jsfs, executeContext) {
  lib.wash.NaCl.main(executeContext);
};

wash.executables.chrome.callbacks['pnacl'] = function(jsfs, executeContext) {
  lib.wash.NaCl.main(executeContext);
};
