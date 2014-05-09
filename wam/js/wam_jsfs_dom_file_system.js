// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.jsfs.DOMFileSystem = function(opt_capacity) {
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

  var onFileSystemError = function (err) {
    console.log('Error getting html5 file system: ' + err);
    this.readyBinding.closeError('wam.FileSystem.RuntimeError', [String(err)]);
  }.bind(this);

  var requestFS = window.requestFileSystem || window.webkitRequestFileSystem;
  requestFS(window.PERSISTENT, this.capacity_,
            onFileSystemFound, onFileSystemError);
};

wam.jsfs.DOMFileSystem.prototype = wam.jsfs.Entry.subclass(['FORWARD', 'LIST']);

wam.jsfs.DOMFileSystem.prototype.getStat = function(onSuccess, onError) {
  wam.async(onSuccess,
            [null,
             { abilities: this.abilities,
               state: this.readyBinding.readyState,
               capacity: this.capacity_,
               source: 'domfs'
             }]);
};

wam.jsfs.DOMFileSystem.prototype.doOrQueue_ = function(callback, onError) {
  if (this.readyBinding.isReadyState('READY')) {
    callback();
  } else {
    this.connect(callback, onError);
  }
};

wam.jsfs.DOMFileSystem.prototype.statEntry_ = function(
    entry, onSuccess, onError) {
  var onMetadata = function(entry, metadata) {
    if (entry.isFile) {
      onSuccess({
        source: 'domfs',
        abilities: ['OPEN'],
        mtime: new Date(metadata.modificationTime).getTime(),
        size: metadata.size
      });
    } else {
      onSuccess({
        source: 'domfs',
        abilities: ['LIST'],
        mtime: new Date(metadata.modificationTime).getTime(),
      });
    }
  };

  if ('getMetadata' in entry) {
    entry.getMetadata(onMetadata.bind(null, entry), onError);
  } else {
    onSuccess({abilities: [], source: 'domfs'});
  }
};

wam.jsfs.DOMFileSystem.prototype.forwardStat = function(
    arg, onSuccess, onError) {
  var onRuntimeError = function(error) {
    onError(wam.mkerr('wam.FileSystem.Error.RuntimeError', [String(error)]));
  };

  var onFileFound = function(entry) {
    this.statEntry_(entry, onSuccess, onRuntimeError)
  }.bind(this);

  var onFileError = function(error) {
    if (error == FileError.TYPE_MISMATCH_ERR) {
      this.domfs_.root.getFile(arg.path, {create: false},
                              onDirFound, onRuntimeError);
    } else if (error == FileError.NOT_FOUND_ERR) {
      onError(wam.mkerr('wam.FileSystem.Error.NotFound', [arg.path]));
    } else {
      onRuntimeError(error);
    }
  }.bind(this);

  var onDirFound = function(entry) {
    this.statEntry_(entry, onSuccess, onRuntimeError);
  }.bind(this);

  var stat = function() {
    this.domfs_.root.getFile(arg.forwardPath, {create: false},
                             onFileFound, onFileError);
  }.bind(this);

  this.doOrQueue_(stat, onError);
};

wam.jsfs.DOMFileSystem.prototype.forwardList = function(
    arg, onSuccess, onError) {
  var entries = [];
  var rv = {};
  var mdgot = 0;

  var onStat = function(name, stat) {
    rv[name] = {stat: stat};
    if (++mdgot == entries.length)
      onSuccess(rv);
  };

  var onRuntimeError = function(error) {
    onError(wam.mkerr('wam.FileSystem.Error.RuntimeError', [String(error)]));
  };

  var onReadEntries = function(reader, results) {
    if (!results.length) {
      if (!entries.length) {
        onSuccess(rv);
        return;
      }

      for (var i = 0; i < entries.length; i++) {
        this.statEntry_(entries[i],
                        onStat.bind(null, entries[i].name),
                        onRuntimeError);
      }
    } else {
      entries = entries.concat(results);
      reader.readEntries(onReadEntries.bind(null, reader));
    }
  }.bind(this);

  var onDirectoryFound = function(dirEntry) {
    var reader = dirEntry.createReader();
    reader.readEntries(onReadEntries.bind(null, reader));
  };

  var list = function() {
    console.log('path: ' + arg.forwardPath);
    this.domfs_.root.getDirectory(arg.forwardPath, {create: false},
                                  onDirectoryFound, onRuntimeError);
  }.bind(this);

  this.doOrQueue_(list, onError);
};

wam.jsfs.DOMFileSystem.prototype.forwardExecute = function(arg) {
  arg.executeRequest.closeError(
      'wam.FileSystem.Error.OperationNotSupported', []);
};

wam.jsfs.DOMFileSystem.prototype.onBindingReady_ = function() {
  while (this.pendingOperations_.length) {
    var onSuccess = this.pendingOperations_.shift()[0];
    onSuccess();
  }
};

wam.jsfs.DOMFileSystem.prototype.onBindingClose_ = function(reason, value) {
  if (reason == 'error') {
    while (this.pendingOperations_.length) {
      var onError = this.pendingOperations_.shift()[1];
      onError();
    }
  }
};
