// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * An object that connects a wam.binding.fs.FileSystem to an in-memory file
 * system composed of objects derived from wam.jsfs.Entry.
 *
 * See wam.jsfs.Directory, wam.jsfs.Executable, wam.jsfs.RemoteFileSystem,
 * and wam.jsfs.dom.FileSystem for examples of entries that can be used
 * with one of these.
 *
 * @param {wam.jsfs.Directory} opt_rootDirectory An optional directory instance
 *   to use as the root.
 */
wam.jsfs.FileSystem = function(opt_rootDirectory) {
  this.rootDirectory_ = opt_rootDirectory || new wam.jsfs.Directory();
  this.defaultBinding = new wam.binding.fs.FileSystem();
  this.addBinding(this.defaultBinding);
  this.defaultBinding.ready();
};

/**
 * Connect a file system binding to this file system implementation.
 *
 * We'll subscribe to events on the binding and provide the implementation for
 * stat, unlink, list, execute, and open related functionality.
 *
 * @param {wam.binding.fs.FileSystem} binding
 */
wam.jsfs.FileSystem.prototype.addBinding = function(binding) {
  binding.onStat.addListener(this.onStat_, this);
  binding.onUnlink.addListener(this.onUnlink_, this);
  binding.onList.addListener(this.onList_, this);
  binding.onExecuteContextCreated.addListener(
      this.onExecuteContextCreated_, this);
  binding.onOpenContextCreated.addListener(
      this.onOpenContextCreated_, this);

  binding.onClose.addListener(this.removeBinding.bind(this, binding));
};

/**
 * Remove a binding.
 *
 * @param {wam.binding.fs.FileSystem} binding
 */
wam.jsfs.FileSystem.prototype.removeBinding = function(binding) {
  binding.onStat.removeListener(this.onStat_, this);
  binding.onUnlink.removeListener(this.onUnlink_, this);
  binding.onList.removeListener(this.onStat_, this);
  binding.onExecuteContextCreated.removeListener(
      this.onExecuteContextCreated_, this);
  binding.onOpenContextCreated.removeListener(
      this.onOpenContextCreated_, this);
};

/**
 * Publish this file system on the given wam.Channel.
 *
 * If the other end of the channel offers a 'wam.Filesystem' handshake, we'll
 * accept it on behalf of this file system.
 *
 * @param {wam.Channel} channel The channel to publish on.
 * @param {string} name A short name to identify this file system to the other
 *   party.  This is sent to the other party when we accept their handshake
 *   offer.  There is currently no provision for selecting a file system by
 *   name as part of the handshake offer.
 */
wam.jsfs.FileSystem.prototype.publishOn = function(channel, name) {
  var readyValue = name ? {name: name} : null;

  channel.onHandshakeOffered.addListener(function(offerEvent) {
      if (offerEvent.response ||
          !wam.remote.fs.testOffer(offerEvent.inMessage)) {
        return;
      }

      this.handshakeResponse = new wam.remote.fs.handshake.Response(
          offerEvent.inMessage, this.defaultBinding);

      this.handshakeResponse.sendReady(readyValue);
      offerEvent.response = this.handshakeResponse;
    }.bind(this));
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

/**
 * Call ..makePath sequentially, once for each path in pathList.
 *
 * If any path fails, stop the sequence and call onError.
 *
 * @param {Array<string>} pathList The list of paths to create.
 * @param {function()} onSuccess The function to invoke if all paths are created
 *   successfully.
 * @param {function(wam.Error)} onError The function to invoke if a path fails.
 *   Remaining paths will not be created.
 */
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
 * Add a wam.jsfs.Entry subclass to the file system at the specified path.
 *
 * If necessary, wam.jsfs.Directory entries will be created for missing
 * path elements.
 *
 * @param {string} path The path to the entry.
 * @param {wam.jsfs.Entry} entry The wam.jsfs.Entry subclass to place at the
 *   path.
 * @param {function()} onSuccess The function to invoke on success.
 * @param {function(wam.Error)} onError The function to invoke on error.
 */
wam.jsfs.FileSystem.prototype.makeEntry = function(
    path, entry, onSuccess, onError) {
  var dirName = wam.binding.fs.dirName(path);
  var baseName = wam.binding.fs.baseName(path);
  var map = {};
  map[baseName] = entry;
  this.makeEntries(dirName, map, onSuccess, onError);
};

/**
 * Ensure that the given path exists, then add the given entries to it.
 *
 * @param {string} path The path to the parent directory for these entries.
 *   Will be created if necessary.
 * @param {Object} entryMap A map of one or more {name: wam.jsfs.Entry}.
 * @param {function()} onSuccess The function to invoke on success.
 * @param {function(wam.Error)} onError The function to invoke on error.
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

/**
 * Resolve the given path as far as possible.
 *
 * The success callback will receive three arguments:
 *   prefixList - An array of path names that were successfully resolved.
 *   pathList - The remaining path names, starting with the first that could not
 *     be found.
 *   entry - The entry instance that represents the final element of prefixList.
 *     This is not guaranteed to be a directory entry.
 *
 * If the partialResolve succeeds, it means that all of the path elements on the
 * prefixList were found, and the elements on the pathList are yet-to-be
 * resolved.  The entry is the final wam.jsfs.Entry that was resolved.
 *
 * The meaning of this success depends on the context.  If the resolved Entry
 * can 'FORWARD', then this isn't necessarily a completed success or failure
 * yet.
 *
 * @param {string} path The path to resolve.
 * @param {function(Array, Array, wam.jsfs.Entry)} The function to invoke on
 *   success.
 * @param {function(wam.Error)} onError The function to invoke on error.
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

/**
 * Handle the onStat event for a wam.binding.fs.FileSystem.
 */
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

    entry.getStat(onSuccess, onError);
  };

  this.partialResolve(arg.path, onPartialResolve, onError);
};

/**
 * Handle the onUnlink event for a wam.binding.fs.FileSystem.
 */
wam.jsfs.FileSystem.prototype.onUnlink_ = function(arg, onSuccess, onError) {
  if (typeof arg.path != 'string') {
    console.error('Missing argument: path');
    wam.async(onError,
              [null, wam.mkerr('wam.Error.MissingArgument', ['path'])]);
    return;
  }

  var onPartialResolve = function(prefixList, pathList, entry) {
    if (entry.can('FORWARD')) {
      entry.forwardUnlink
      ({fullPath: arg.path, forwardPath: pathList.join('/') + '/' + targetName},
       onSuccess, onError);
      return;
    }

    if (pathList.length) {
      onError(wam.mkerr('wam.FileSystem.Error.NotFound', [parentPath]));
      return;
    }

    if (!entry.can('LIST')) {
      onError(wam.mkerr('wam.FileSystem.Error.NotListable', [parentPath]));
      return;
    }

    entry.doUnlink(targetName, onSuccess, onError);
  };

  var parentPath = wam.binding.fs.dirName(arg.path);
  var targetName = wam.binding.fs.baseName(arg.path);

  this.partialResolve(parentPath, onPartialResolve, onError);
};

/**
 * Handle the onList event for a wam.binding.fs.FileSystem.
 */
wam.jsfs.FileSystem.prototype.onList_ = function(arg, onSuccess, onError) {
  if (!onSuccess || !onError)
    throw new Error('Missing callback', onSuccess, onError);

  if (typeof arg.path != 'string') {
    console.error('Missing argument: path');
    wam.async(onError,
              [null, wam.mkerr('wam.FileSystem.Error.BadOrMissingArgument',
                               ['path'])]);
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
      onError(wam.mkerr('wam.FileSystem.Error.NotFound', [arg.path]));
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

/**
 * Handle the onExecuteContextCreated event for a wam.binding.fs.FileSystem.
 */
wam.jsfs.FileSystem.prototype.onExecuteContextCreated_ = function(
    executeContext) {
  new wam.jsfs.ExecuteContext(this, executeContext);
};

/**
 * Handle the onOpenContextCreated event for a wam.binding.fs.FileSystem.
 */
wam.jsfs.FileSystem.prototype.onOpenContextCreated_ = function(openContext) {
  new wam.jsfs.OpenContext(this, openContext);
};
