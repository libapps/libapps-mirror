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
 * Usage: cat <path> ...
 *
 * Concatenate one or more files to stdout.
 */
wash.executables.callbacks['cat'] = function(executeContext) {
  executeContext.ready();

  var pwd = executeContext.getEnv('PWD', '/');
  var path = null;
  var arg = executeContext.arg;

  if (!(arg instanceof Array)) {
    executeContext.closeError('wam.FileSystem.Error.UnexpectedArgvType',
                              ['array']);
    return;
  }

  var onReadError = function(value) {
    executeContext.stderr('cat: ' + path + ': ' + JSON.stringify(value) + '\n');
    catNextArg();
  };

  var onReadSuccess = function(result) {
    var output = result.data;
    if (output.substr(output.length - 1) != '\n')
      output += '\n';

    executeContext.stdout(output);
    catNextArg();
  };

  var catNextArg = function() {
    if (!executeContext.arg.length) {
      executeContext.closeOk(null);
      return;
    }

    path = wam.binding.fs.absPath(pwd, arg.shift());
    executeContext.readFile(path, {}, {dataType: 'utf8-string'},
                            onReadSuccess, onReadError);
  };

  catNextArg();
};

/**
 * Usage: cp <source> ... <target>
 *
 * Copy one or more source files to a target path.
 *
 * Does not handle recursive copies, each source must be a file.  If the target
 * is a directory then the target will be copied with the source file name in
 * the target directory.
 */
wash.executables.callbacks['cp'] = function(executeContext) {
  executeContext.ready();

  var arg = executeContext.arg;
  if (!(arg instanceof Array)) {
    executeContext.closeError('wam.FileSystem.Error.UnexpectedArgvType',
                              ['array']);
    return;
  }

  if (arg.length < 2) {
    executeContext.closeError('wam.FileSystem.Error.RuntimeError',
                              ['Usage: cp <source> ... <target>']);
    return;
  }

  var pwd = executeContext.getEnv('PWD', '/');
  var targetPath = wam.binding.fs.absPath(pwd, arg.pop());
  var targetIsDirectory = false;

  // Copy the next source file on the list.
  var copyNextSource = function() {
    if (arg.length == 0) {
      executeContext.closeOk(null);
      return;
    }

    var sourcePath = wam.binding.fs.absPath(pwd, arg.shift());
    var path = (targetIsDirectory ?
                targetPath + '/' + wam.binding.fs.baseName(sourcePath) :
                targetPath);

    executeContext.stdout('cp: ' + sourcePath + ' -> ' + path + '\n');
    executeContext.copyFile(sourcePath,
                            path,
                            copyNextSource,
                            function(value) {
                              executeContext.closeErrorValue(value);
                            });
  };

  // We've successfully stat'd the target path, so we know it exists.  This is
  // ok if the target is a directory, or if we're going to overwrite the target
  // with a single source file.
  var onTargetStatSuccess = function(statResult) {
    if (statResult.abilities.indexOf('LIST') != -1) {
      targetIsDirectory = true;

    } else if (statResult.abilities.indexOf('OPEN') != -1) {
      if (arg.length > 1) {
        executeContext.closeError(
            'wam.FileSystem.Error.RuntimeError',
            ['Multiple sources, but destination is not a directory']);
        return;
      }

      targetIsDirectory = false;
    }

    copyNextSource();
  };

  // Some problem stat'ing the target.  This isn't a problem if the target path
  // represents a new file in an existing directory.
  var onTargetStatError = function(value) {
    if (value.errorName != 'wam.FileSystem.Error.NotFound') {
      executeContext.closeErrorValue(value);
      return;
    }

    if (arg.length > 1) {
      executeContext.closeError(
          'wam.FileSystem.Error.RuntimeError',
          ['Multiple sources, but destination is not a directory']);
      return;
    }

    targetIsDirectory = false;
    copyNextSource();
  };

  executeContext.fileSystem.stat({path: targetPath},
                                 onTargetStatSuccess, onTargetStatError);
};

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

/**
 * Launch an instance of lib.wash.Readline, yay!
 */
wash.executables.callbacks['readline'] = function(executeContext) {
  lib.wash.Readline.main(executeContext);
};

wash.executables.callbacks['rm'] = function(executeContext) {
  executeContext.ready();

  var arg = executeContext.arg || [];

  if (!arg instanceof Array || arg.length == 0) {
    executeContext.closeError('wam.FileSystem.Error.BadOrMissingArgument',
                              ['argv', '[path, ...]']);
    return;
  }

  var pwd = executeContext.getEnv('PWD', '/');

  var unlinkNextFile = function() {
    if (!arg.length) {
      executeContext.closeOk(null);
      return;
    }

    executeContext.fileSystem.unlink(
        {path: wam.binding.fs.absPath(pwd, arg.shift())},
        unlinkNextFile,
        function(value) {
          executeContext.closeErrorValue(value);
        });
  };

  unlinkNextFile();
};

wash.executables.callbacks['stty'] = function(executeContext) {
  executeContext.ready();
  executeContext.stdout(JSON.stringify(executeContext.getTTY(), null, '  '));
  executeContext.stdout('\n');
  executeContext.closeOk();
};

/**
 * Launch the shell.
 */
wash.executables.callbacks['wash'] = function(executeContext) {
  wash.Shell.main(executeContext);
};
