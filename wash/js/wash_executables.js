// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * The stock wash executables.
 */
wash.executables = {};

wash.executables.install = function(jsfs, path, onSuccess, onError) {
  var exes = {};
  for (var key in wash.executables.callbacks) {
    var callback = wash.executables.callbacks[key];
    exes[key] = new wam.jsfs.Executable(callback);
  }

  jsfs.makeEntries(path, exes, onSuccess, onError);
};

wash.executables.callbacks = {};

/**
 * Echo.
 *
 * echo.
 */
wash.executables.callbacks['echo'] = function(executeContext) {
  executeContext.ready();
  executeContext.stdout(executeContext.arg);
  executeContext.closeOk(null);
};

/**
 * Launch an instance of lib.wash.Readline, yay!
 */
wash.executables.callbacks['readline'] = function(executeContext) {
  lib.wash.Readline.main(executeContext);
};

/**
 * Launch the shell.
 */
wash.executables.callbacks['wash'] = function(executeContext) {
  wash.Shell.main(executeContext);
};

wash.executables.callbacks['stty'] = function(executeContext) {
  executeContext.ready();
  executeContext.stdout(JSON.stringify(executeContext.getTTY(), null, '  '));
  executeContext.stdout('\n');
  executeContext.closeOk();
};

wash.executables.callbacks['ls'] = function(executeContext) {
  executeContext.ready();
  var arg = executeContext.arg || [];

  if (!arg instanceof Array) {
    executeContext.closeError('wam.FileSystem.Error.UnexpectedArgvType',
                              ['array']);
    return;
  }

  var path = arg[0] || '';
  path = wam.binding.fs.absPath(executeContext.getEnv('PWD', '/'), path);

  var formatStat = function(stat) {
    var prefix = stat.source || '';

    if (stat.mtime) {
      var d = new Date(stat.mtime);
      stat.mtime = d.getFullYear() + '-' + lib.f.zpad(d.getMonth() + 1, 2) +
          '-' + lib.f.zpad(d.getDay(), 2) + ' ' + d.toLocaleTimeString();
    }

    delete stat.source;
    delete stat.abilities;
    var keys = Object.keys(stat).sort();

    var ary = [];
    for (var i = 0; i < keys.length; i++) {
      ary.push(keys[i] + ': ' + JSON.stringify(stat[keys[i]]));
    }

    var suffix = ary.join(', ');

    if (!prefix && !suffix)
      return '???';

    if (prefix && !suffix)
      return '[' + prefix + ']';

    return (prefix ? '[' + prefix + '] ' : '') + suffix;
  };

  executeContext.fileSystem.list
  ({path: path},
   function(listResult) {
     var names = Object.keys(listResult).sort();

     var rv = 'count ' + names.length + '\n';

     if (names.length > 0) {
       var longest = names[0].length;
       names.forEach(function(name) {
           if (name.length > longest) longest = name.length;
         });

       names.forEach(function(name) {
           var stat = listResult[name].stat;
           rv += name;
           rv += (stat.abilities.indexOf('LIST') == -1) ? ' ' : '/';
           for (var i = 0; i < longest - name.length; i++) {
             rv += ' ';
           }

           rv += '   ' + formatStat(stat) + '\n';
         });
     }

     executeContext.stdout(rv);
     executeContext.closeOk(null);
   },
   function(value) {
     if (value.errorName == 'wam.FileSystem.Error.NotListable') {
       executeContext.fileSystem.stat
           ({path: path},
            function(stat) {
              executeContext.stdout(wam.binding.fs.baseName(path) + '  ' +
                                    formatStat(stat) + '\n');
              executeContext.closeOk(null);
            },
            function(value) {
              executeContext.closeErrorValue(value);
            });
     } else {
       executeContext.closeErrorValue(value);
     }
   });
};
