// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.wa.fs.Remote');

/**
 * A filesystem entry that contains other filesystem entries.
 */
lib.wa.fs.Directory = function() {
  lib.wa.fs.Entry.call(this);
  this.registerMessages(lib.wa.fs.Directory.on);

  this.entries_ = {};
};

lib.wa.fs.Directory.prototype = {__proto__: lib.wa.fs.Entry.prototype};

lib.wa.fs.Directory.prototype.type = lib.wa.fs.entryType.DIRECTORY;

/**
 * Link a path to a given lib.wa.fs.Entry.
 *
 * @param {string} path The target path.
 * @param {lib.wa.fs.Entry} entry A lib.wa.fs.Entry subclass to link at the
 *     target path.
 * @param {function(lib.wa.fs.Entry)} onSuccess The function to invoke on
 *     success.
 * @param {function(name, arg)} onSuccess The function to invoke on
 *     error.
 */
lib.wa.fs.Directory.prototype.link = function(path, entry, onSuccess, onError) {
  if (!onSuccess || !onError)
    throw new Error('Missing onSuccess or onError');

  if (!(entry instanceof lib.wa.fs.Entry))
    throw new Error('Invalid entry: ' + entry);

  var baseName = lib.wa.fs.basename(path);
  var dirName = lib.wa.fs.dirname(path);

  var onResolve = function(dirEntry) {
    if (dirEntry.type != lib.wa.fs.entryType.DIRECTORY) {
      onError(lib.wa.error.FS_NOT_A_DIRECTORY, path);
      return;
    }

    if (!dirEntry.isLocal) {
      onError(lib.wa.error.FS_NOT_LOCAL, path);
      return;
    }

    if (dirEntry.resolveName(baseName)) {
      onError(lib.wa.error.FS_FILE_EXISTS, path);
      return;
    }

    dirEntry.entries_[baseName] = entry;

    onSuccess(entry);
  }.bind(this);

  this.resolvePath(dirName, onResolve, onError);
};

/**
 * Mount a remote filesystem into this directory structure.
 *
 * @param {lib.wa.Message} readyMsg An inbound 'ready' message that in response
 *     to an 'open' or 'handshake' message.  This roots the remote filesystem.
 * @param {string} localPath The local path to the mount point.
 * @param {string} remotePath The sub-directory of the remote filesystem to
 *     base this Remote on.
 * @param {function(lib.wa.fs.Remote)} The function to call on success.
 * @param {function(lib.wa.Message)} The function to call on error.
 */
lib.wa.fs.Directory.prototype.mount = function(
    readyMsg, localPath, remotePath, onSuccess, onError) {

  if (!onSuccess || !onError)
    throw new Error('Missing onSuccess or onError');

  lib.wa.fs.Remote.create(
      readyMsg, remotePath,
      function (entry) {
        this.link(localPath, entry, onSuccess, onError);
      }.bind(this),
      onError);
};

/**
 * Resolve a entry of this directory.
 */
lib.wa.fs.Directory.prototype.resolveName = function(name) {
  if (!this.entries_.hasOwnProperty(name))
    return null;

  return this.entries_[name];
};

/**
 * Resolve a path of arbitrary depth.
 *
 * Recurses at each leaf of the path.
 */
lib.wa.fs.Directory.prototype.resolvePath = function(path, onSuccess, onError) {
  if (!onSuccess || !onError) {
    console.log(lib.f.getStack());
    throw new Error('Missing onSuccess or onError');
  }

  if (!path || path == '/')
    return onSuccess(this);

  var ary = path.match(/^\/?([^/]+)(.*)/);
  if (!ary)
    throw new Error(liv.wa.error.FS_INVALID_PATH, path);

  var name = ary[1];
  var rest = ary[2];

  if (!this.entries_.hasOwnProperty(name))
    return onError(lib.wa.error.FS_NOT_FOUND, name);

  var entry = this.entries_[name];

  if (!rest)
    return onSuccess(entry);

  if (entry.type != lib.wa.fs.entryType.DIRECTORY)
    return onError(lib.wa.error.FS_NOT_A_DIRECTORY, name);

  entry.resolvePath(rest, onSuccess, onError);
};

/**
 * Message handlers reachable via lib.wa.fs.Entry.prototype.dispatchMessage.
 *
 * All of these functions are invoked with an instance of lib.wa.fs.Directory
 * as `this`, in response to some inbound lib.wa.Message.
 */
lib.wa.fs.Directory.on = {};

/**
 * Execute an entry.
 *
 * If the resolved lib.wa.fs.Entry is an executable, the message is passed
 * to the entry to handle.  Otherwise we raise an error.
 */
lib.wa.fs.Directory.on['execute'] = function(execMsg) {
  if (!execMsg.arg.path) {
    execMsg.closeError(lib.wa.error.MISSING_PARAM, 'path');
    return;
  }

  var onResolve = function(entry) {
    if (entry.type != lib.wa.fs.entryType.EXECUTABLE) {
      execMsg.closeError(lib.wa.error.FS_NOT_AN_EXECUTABLE, execMsg.arg.path);
      return;
    }

    entry.dispatchMessage(execMsg.arg.path, execMsg);
  };

  if (!execMsg.isOpen) {
    console.warn('Execute message is not expecting a reply.');
    return;
  }

  this.resolvePath(execMsg.arg.path, onResolve,
                   execMsg.closeError.bind(execMsg));
};

/**
 * Open a file.
 *
 * This replies with an open-ended 'ready' message that allows the caller to
 * issue further messages targeted to the opened file.
 */
lib.wa.fs.Directory.on['open'] = function(openMsg) {
  var onResolve = function(entry) {
    var readyMsg = openMsg.replyReady({type: entry.type});

    openMsg.meta.onInput.addListener(function(msg) {
        entry.dispatchMessage(openMsg.arg.path, msg);
      });
  };

  if (!openMsg.isOpen) {
    console.warn('Open message is not expecting a reply.');
    return;
  }

  this.resolvePath(openMsg.arg.path, onResolve,
                   openMsg.closeError.bind(openMsg));
};

/**
 * Read the contents of this directory.
 *
 * TODO(rginda) This should provide a path argument so that callers don't need
 * to 'open' before reading.
 */
lib.wa.fs.Directory.on['read'] = function(msg) {
  var entries = {};
  for (var key in this.entries_) {
    entries[key] = {
      name: key,
      type: this.entries_[key].type
    };
  }

  msg.closeOk({entries: entries});
};
