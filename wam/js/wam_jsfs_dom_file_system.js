// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * A jsfs.Entry subclass that proxies to a DOM LocalFileSystem.
 */
wam.jsfs.dom.FileSystem = function(opt_capacity) {
  wam.jsfs.Entry.call(this);

  this.capacity_ = opt_capacity || 16 * 1024 * 1024;

  this.domfs_ = null;
  this.pendingOperations_ = [];

  this.readyBinding = new wam.binding.Ready();
  this.readyBinding.onReady.addListener(this.onBindingReady_, this);
  this.readyBinding.onClose.addListener(this.onBindingClose_, this);

  var onFileSystemFound = function (fileSystem) {
    this.domfs_ = fileSystem;
    this.readyBinding.ready();
  }.bind(this);

  var onFileSystemError = function (error) {
    console.log('Error getting html5 file system: ' + error);
    this.readyBinding.closeError(wam.jsfs.dom.convertError(error));
  }.bind(this);

  var requestFS = window.requestFileSystem || window.webkitRequestFileSystem;
  requestFS(window.PERSISTENT, this.capacity_,
            onFileSystemFound, onFileSystemError);
};

/**
 * We're an Entry subclass that is able to FORWARD and LIST.
 */
wam.jsfs.dom.FileSystem.prototype =
    wam.jsfs.Entry.subclass(['FORWARD', 'LIST']);

/**
 * Return a wam 'stat' value for the FileSystem itself.
 *
 * This is a jsfs.Entry method needed as part of the 'LIST' action.
 */
wam.jsfs.dom.FileSystem.prototype.getStat = function(onSuccess, onError) {
  wam.async(onSuccess,
            [null,
             { abilities: this.abilities,
               state: this.readyBinding.readyState,
               capacity: this.capacity_,
               source: 'domfs'
             }]);
};

/**
 * If this FileSystem isn't ready, try to make it ready and queue the callback
 * for later, otherwise call it right now.
 *
 * @param {function()} callback The function to invoke when the file system
 *   becomes ready.
 * @param {function(wam.Error)} onError The function to invoke if the
 *   file system fails to become ready.
 */
wam.jsfs.dom.FileSystem.prototype.doOrQueue_ = function(callback, onError) {
  if (this.readyBinding.isReadyState('READY')) {
    callback();
  } else {
    this.connect(callback, onError);
  }
};

/**
 * Utility method converts a DOM FileError and a path into an appropriate
 * 'wam.FileSystem.Error' value and passes it to the given onError function.
 *
 * The signature for this method is backwards because it's typically used
 * in conjunction with onFileError_.bind(this, onError, path), where the final
 * error parameter will be supplied later.
 *
 * @param {function(wam.Error)} onError The function to invoke with the
 *   converted error.
 * @param {string} path The path associated with the with the error.
 * @param {FileError} The DOM FileError to convert.
 */
wam.jsfs.dom.FileSystem.prototype.onFileError_ = function(
    onError, path, error) {
  onError(wam.jsfs.dom.convertFileError(error, path));
};

/**
 * Same as ..onFileError_, except used when reporting an error about a DirEntry.
 */
wam.jsfs.dom.FileSystem.prototype.onDirError_ = function(
    onError, path, error) {
  onError(wam.jsfs.dom.convertDirError(error, path));
};

/**
 * Forward a stat call to the LocalFileSystem.
 *
 * This is a jsfs.Entry method needed as part of the 'FORWARD' action.
 */
wam.jsfs.dom.FileSystem.prototype.forwardStat = function(
    arg, onSuccess, onError) {
  var onFileFound = function(entry) {
    wam.jsfs.dom.statEntry(
        entry, onSuccess,
        this.onFileError_.bind(this, onError, arg.forwardPath));
  }.bind(this);

  var onDirFound = function(entry) {
    wam.jsfs.dom.statEntry(
        entry, onSuccess,
        this.onDirError_.bind(this, onError, arg.forwardPath));
  }.bind(this);

  var onFileResolveError = function(error) {
    if (error.name == 'TypeMismatchError') {
      this.domfs_.root.getDirectory(
          arg.path, {create: false},
          onDirFound,
          this.onDirError_.bind(this, onError, arg.forwardPath));
    } else {
      this.onFileError_(onError, arg.forwardPath, error);
    }
  }.bind(this);

  var stat = function() {
    this.domfs_.root.getFile(arg.forwardPath, {create: false},
                             onFileFound, onFileResolveError);
  }.bind(this);

  this.doOrQueue_(stat, onError);
};

/**
 * Forward an unlink call to the LocalFileSystem.
 *
 * This is a jsfs.Entry method needed as part of the 'FORWARD' action.
 */
wam.jsfs.dom.FileSystem.prototype.forwardUnlink = function(
    arg, onSuccess, onError) {
  var onFileFound = function(entry) {
    entry.remove(
        onSuccess,
        this.onFileError_.bind(this, onError, arg.forwardPath));
  }.bind(this);

  var onDirFound = function(entry) {
    entry.removeRecursively(
        onSuccess,
        this.onDirError_.bind(this, onError, arg.forwardPath));
  }.bind(this);

  var onFileResolveError = function(error) {
    if (error.name == 'TypeMismatchError') {
      this.domfs_.root.getDirectory(
          arg.path, {create: false},
          onDirFound,
          this.onDirError_.bind(this, onError, arg.forwardPath));
    } else {
      this.onFileError_(onError, arg.forwardPath, error);
    }
  }.bind(this);

  this.doOrQueue_(function() {
      this.domfs_.root.getFile(arg.forwardPath, {create: false},
                               onFileFound, onFileResolveError);
    }.bind(this),
    onError);
};

/**
 * Forward a list call to the LocalFileSystem.
 *
 * This is a jsfs.Entry method needed as part of the 'FORWARD' action.
 */
wam.jsfs.dom.FileSystem.prototype.forwardList = function(
    arg, onSuccess, onError) {
  // List of Entry object we'll need to stat.
  var entries = [];
  // Number of Entry objects we've got metadata results for so far.
  var mdgot = 0;
  // The wam 'list' result.
  var rv = {};

  // Called once per entry to deliver the successful stat result.
  var onStat = function(name, stat) {
    rv[name] = {stat: stat};
    if (++mdgot == entries.length)
      onSuccess(rv);
  };

  // DirEntry.readEntries callback.
  var onReadEntries = function(reader, results) {
    if (!results.length) {
      // If we're called back with no results it means we're done.
      if (!entries.length) {
        onSuccess(rv);
        return;
      }

      for (var i = 0; i < entries.length; i++) {
        wam.jsfs.dom.statEntry(
            entries[i],
            onStat.bind(null, entries[i].name),
            this.onFileError_.bind(this, onError,
                                   arg.forwardPath + '/' + entries[i]));
      }
    } else {
      entries = entries.concat(results);
      reader.readEntries(onReadEntries.bind(null, reader));
    }
  }.bind(this);

  // Delivers the DirEntry for the target directory.
  var onDirectoryFound = function(dirEntry) {
    var reader = dirEntry.createReader();
    reader.readEntries(onReadEntries.bind(null, reader));
  };

  this.doOrQueue_(function() {
      this.domfs_.root.getDirectory(
          arg.forwardPath, {create: false},
          onDirectoryFound,
          this.onDirError_.bind(this, onError, arg.forwardPath));
    }.bind(this),
    onError);
};

/**
 * Forward a wam 'execute' to this file system.
 *
 * Executables are not supported on the DOM file system.
 *
 * This is a jsfs.Entry method needed as part of the 'FORWARD' action.
 *
 * TODO(rginda): We could add support for running nmf files, or wash
 * scripts, or even respect shebangs for shell scripts.  Maybe?
 */
wam.jsfs.dom.FileSystem.prototype.forwardExecute = function(arg) {
  arg.executeContext.closeError('wam.FileSystem.Error.NotExecutable', []);
};

/**
 * Forward a wam 'open' to this file system.
 *
 * This is a jsfs.Entry method needed as part of the 'FORWARD' action.
 */
wam.jsfs.dom.FileSystem.prototype.forwardOpen = function(arg) {
  this.doOrQueue_(function() {
      arg.openContext.path = arg.forwardPath;
      var domoc = new wam.jsfs.dom.OpenContext(this.domfs_, arg.openContext);
      domoc.onOpen_({path: arg.forwardPath, arg: arg.arg});
    }.bind(this),
    function(value) { arg.openContext.closeError(value) });
};

/**
 * Drain with success any pending doOrQueue_'s when we become ready.
 */
wam.jsfs.dom.FileSystem.prototype.onBindingReady_ = function() {
  while (this.pendingOperations_.length) {
    var onSuccess = this.pendingOperations_.shift()[0];
    onSuccess();
  }
};

/**
 * Drain with error any pending doOrQueue_'s if we close due to an error.
 */
wam.jsfs.dom.FileSystem.prototype.onBindingClose_ = function(reason, value) {
  if (reason == 'error') {
    while (this.pendingOperations_.length) {
      var onError = this.pendingOperations_.shift()[1];
      onError();
    }
  }
};
