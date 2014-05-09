// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Shell builtins with special access to the current shell instance.
 *
 * These are not installed in the local JSFS filesystem because builtins
 * are scoped to this shell instance, but the JSFS filesystem is shared across
 * all wash shells.
 */
wash.builtins = function(shell) {
  this.shell = shell;
};

wash.builtins.install = function(shell, jsfs, path, onSuccess, onError) {
  var exes = {};
  for (var key in wash.builtins.callbacks) {
    var callback = wash.builtins.callbacks[key];
    exes[key] = new wam.jsfs.Executable(callback.bind(null, shell));
  }

  jsfs.makeEntries(path, exes, onSuccess, onError);
};

wash.builtins.callbacks = {};

wash.builtins.callbacks['pwd'] = function(shell, executeContext) {
  executeContext.ready();
  var pwd = shell.executeContext.getEnv('PWD', '/');
  executeContext.closeOk(pwd);
};

wash.builtins.callbacks['cd'] = function(shell, executeContext) {
  executeContext.ready();
  var arg = executeContext.arg || ['/'];

  if (!arg instanceof Array) {
    executeContext.closeError('wam.FileSystem.Error.UnexpectedArgvType',
                              ['array']);
    return;
  }

  var path = arg[0] || '';
  path = wam.binding.fs.absPath(shell.executeContext.getEnv('PWD', '/'), path);

  shell.executeContext.fileSystem.stat
  ({path: path},
   function(statResult) {
     if (statResult.abilities.indexOf('LIST') == -1) {
       executeContext.closeError('wam.FileSystem.Error.NotListable',
                                 [path]);
       return;
     }

     if (!/\/$/.test(path))
       path += '/';

     shell.executeContext.setEnv('PWD', path);
     executeContext.closeOk(null);
   },
   function(value) {
     executeContext.closeErrorValue(value);
   });
};

wash.builtins.callbacks['export'] = function(shell, executeContext) {
  executeContext.ready();

  var arg = executeContext.arg;
  var shellEC = shell.executeContext;

  if (!arg) {
    var env = shellEC.getEnvs();
    for (var key in env) {
      executeContext.stdout(key + ' = ' + JSON.stringify(env[key]) + '\n');
    }

  } else if (arg instanceof Array) {
    if (arg.length == 1) {
      executeContext.stdout(arg[0] + ' = ' + shellEC.getEnv(arg[0]) + '\n');
    } if (arg.length == 2) {
      shellEC.setEnv(arg[0], arg[1]);
    } else {
      executeContext.closeError('wam.FileSystem.Error.UnexpectedArgvType',
                                ['array.length <= 2']);
      return;
    }

  } else {
    executeContext.closeError('wam.FileSystem.Error.UnexpectedArgvType',
                              ['array']);
    return;
  }

  executeContext.closeOk(null);
};
