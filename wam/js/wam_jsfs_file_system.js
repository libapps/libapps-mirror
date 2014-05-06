// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.jsfs.FileSystem = function(opt_rootDirectory) {
  this.rootDirectory_ = opt_rootDirectory || new wam.jsfs.Directory();
};

wam.jsfs.FileSystem.prototype.addBinding = function(binding) {
  binding.onStat.addListener(this.onStat_, this);
  binding.onList.addListener(this.onList_, this);
  binding.onExecuteContextCreated.addListener(
      this.onExecuteContextCreated_, this);

  binding.onClose.addListener(this.removeBinding.bind(this, binding));
};

wam.jsfs.FileSystem.prototype.removeBinding = function(binding) {
  binding.onStat.removeListener(this.onStat_, this);
  binding.onList.removeListener(this.onStat_, this);
  binding.onExecuteContextCreated.removeListener(
      this.onExecuteContextCreated_, this);
};

/**
 * Ensure that the given path exists.
 *
 * Any missing directories are created as wam.jsfs.Directory instances.
 * The onSuccess handler will be passed the final directory instance.  If
 * an error occurs, the path may have been partially constructed.
 */
wam.jsfs.FileSystem.prototype.makePath = function(
    path, onSuccess, onError) {
  var makeNextPath = function(directoryEntry, pathList) {
    if (pathList.length == 0) {
      onSuccess(directoryEntry);
      return;
    }

    var childDir = new wam.jsfs.Directory();
    directoryEntry.addEntry(pathList.shift(),
                            childDir,
                            makeNextPath.bind(null, childDir, pathList),
                            onError);
  };

  this.partialResolve
  (path,
   function (prefixList, pathList, resolvedEntry) {
     if (!resolvedEntry) {
       onError(wam.mkerr('wam.FileSystem.Error.NotFound', [path]));
       return;
     }

     if (!resolvedEntry.can('LIST')) {
       onError(wam.mkerr('wam.FileSystem.Error.NotListable',
                         ['/' + prefixList.join('/')]));
       return;
     }

     if (pathList.length == 0) {
       onSuccess(resolvedEntry);
       return;
     }

     makeNextPath(resolvedEntry, pathList);
   },
   onError);
};

wam.jsfs.FileSystem.prototype.makePaths = function(
    pathList, onSuccess, onError) {
  var makeNextPath = function(i, directoryEntry) {
    if (i == pathList.length) {
      onSuccess(directoryEntry);
      return;
    }

    this.makePath(pathList[i], makeNextPath.bind(null, i + 1), onError);
  }.bind(this);

  makeNextPath(0, null);
};

/**
 * Ensure that the given path exists, then add the given entries to it.
 */
wam.jsfs.FileSystem.prototype.makeEntries = function(
    path, entryMap, onSuccess, onError) {

  var entryNames = Object.keys(entryMap);
  var makeNextEntry = function(directoryEntry) {
    if (entryNames.length == 0) {
      onSuccess(directoryEntry);
      return;
    }

    var name = entryNames.shift()
    directoryEntry.addEntry(name, entryMap[name],
                            makeNextEntry.bind(null, directoryEntry),
                            onError);
  };

  this.makePath(path, makeNextEntry, onError);
};

wam.jsfs.FileSystem.prototype.resolve = function(path, onSuccess, onError) {
  if (typeof path != 'string') {
    console.error('Missing argument: path');
    wam.async(onError,
              [null, wam.mkerr('wam.Error.MissingArgument', ['path'])]);
    return;
  }

  path = path || '/';

  var onPartialResolve = function(prefixList, pathList, entry) {
    if (pathList.length) {
      onError(wam.mkerr('wam.FileSystem.Error.NotFound', [path]));
      return;
    }

    onSuccess(entry);
  };

  this.partialResolve(path, onPartialResolve, onError);
};

/**
 * Resolve the given path as far as possible.
 *
 * The success callback will receive three arguments:
 *   prefixList - An array of path names that were successfully resolved.
 *   pathList - The remaining path names, starting with the first that could not
 *     be found.
 *   entry - The entry instance that represents the final element of prefixList.
 *     This is not guaranteed to be a directory entry.
 */
wam.jsfs.FileSystem.prototype.partialResolve = function(
    path, onSuccess, onError) {
  if (!onSuccess || !onError)
    throw new Error('Missing onSuccess or onError');

  if (!path || path == '/') {
    wam.async(onSuccess, [null, [], [], this.rootDirectory_]);
    return;
  }

  var ary = path.match(/^\/?([^/]+)(.*)/);
  if (!ary) {
    wam.async(onError,
              [null, wam.mkerr('wam.FileSystem.Error.InvalidPath', [path])]);
    return;
  }

  if (path.substr(0, 1) == '/')
    path = path.substr(1);

  this.rootDirectory_.partialResolve(
      [], wam.binding.fs.splitPath(path),
      onSuccess, onError);
};

wam.jsfs.FileSystem.prototype.onStat_ = function(arg, onSuccess, onError) {
  if (typeof arg.path != 'string') {
    console.error('Missing argument: path');
    wam.async(onError,
              [null, wam.mkerr('wam.Error.MissingArgument', ['path'])]);
    return;
  }

  var onPartialResolve = function(prefixList, pathList, entry) {
    if (entry.can('FORWARD')) {
      entry.forwardStat
      ({fullPath: arg.path, forwardPath: pathList.join('/')},
       onSuccess, onError);
      return;
    }

    if (pathList.length) {
      onError(wam.mkerr('wam.FileSystem.Error.NotFound', [arg.path]));
      return;
    }

    onSuccess(entry);
  };

  this.partialResolve(arg.path, onPartialResolve, onError);
};

wam.jsfs.FileSystem.prototype.onList_ = function(arg, onSuccess, onError) {
  if (typeof arg.path != 'string') {
    console.error('Missing argument: path');
    wam.async(onError,
              [null, wam.mkerr('wam.Error.MissingArgument', ['path'])]);
    return;
  }

  var onPartialResolve = function(prefixList, pathList, entry) {
      if (entry.can('FORWARD')) {
        entry.forwardList
        ({fullPath: arg.path, forwardPath: pathList.join('/')},
         onSuccess, onError);
        return;
      }

    if (pathList.length) {
      onError(wam.mkerr('wam.FileSystem.Error.NotFound', [path]));
      return;
    }

    if (!entry.can('LIST')) {
      onError(wam.mkerr('wam.FileSystem.Error.NotListable', [arg.path]));
      return;
    }

    entry.listEntryStats(onSuccess);
  };

  this.partialResolve(arg.path, onPartialResolve, onError);
};

wam.jsfs.FileSystem.prototype.onOpen_ = function(arg, onSuccess, onError) {
  // TODO: implement.
};

wam.jsfs.FileSystem.prototype.onExecuteContextCreated_ = function(
    executeContext) {
  new wam.jsfs.ExecuteContext(this, executeContext);
};
