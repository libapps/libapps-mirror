// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * An object that connects a wam.binding.fs.OpenContext to an open file on a
 * DOM LocalFileSystem.
 */
wam.jsfs.dom.OpenContext = function(domfs, openContextBinding) {
  // Raw DOM LocalFileSystem instance, not the wam.jsfs.dom.FileSystem.
  this.domfs_ = domfs;

  // The current read/write position.
  this.position_ = 0;
  // The DOM FileEntry we're operating on.
  this.entry_ = null;
  // The DOM File we're operating on.
  this.file_ = null;

  /**
   * The wam.binding.fs.OpenContext we're working for.
   */
  this.openContextBinding = openContextBinding;
  openContextBinding.onSeek.addListener(this.onSeek_, this);
  openContextBinding.onRead.addListener(this.onRead_, this);
  openContextBinding.onWrite.addListener(this.onWrite_, this);

  /**
   * The path we were opened for.
   */
  this.path = openContextBinding.path;
};

/**
 * Utility function to perform a seek (update this.position_).
 *
 * Invokes onError with a wam.FileSystem.Error value and returns false on
 * error.
 *
 * If the arg object does not have a 'whence' property, this call succeeds
 * with no side effects.
 *
 * @param {Object} arg An object containing 'whence' and 'offset' arguments
 *  describing the seek operation.
 */
wam.jsfs.dom.OpenContext.prototype.seek_ = function(arg, onError) {
  var fileSize = this.file_.size;
  var start = this.position_;

  if (!arg.whence)
    return true;

  if (arg.whence == 'begin') {
    start = arg.offset;

  } else if (arg.whence == 'current') {
    start += arg.offset;

  } else if (arg.whence == 'end') {
    start = fileSize + arg.offset;
  }

  if (start > fileSize) {
    onError(wam.mkerr('wam.FileSystem.Error.EndOfFile', []));
    return false;
  }

  if (start < 0) {
    onError(wam.mkerr('wam.FileSystem.Error.BeginningOfFile', []));
    return false;
  }

  this.position_ = start;
  return true;
};

/**
 * Convenience method to close out this context with a wam.Error value.
 */
wam.jsfs.dom.OpenContext.prototype.onWamError_ = function(wamError) {
  this.openContextBinding.closeErrorValue(wamError);
};

/**
 * Convenience method to convert a FileError to a wam.FileSystem.Error value
 * close this context with it.
 *
 * Used in the context of a FileEntry.
 */
wam.jsfs.dom.OpenContext.prototype.onFileError_ = function(error) {
  this.onWamError_(wam.jsfs.dom.convertFileError(error, this.path));
};

/**
 * Convenience method to convert a FileError to a wam.FileSystem.Error value
 * close this context with it.
 *
 * Used in the context of a DirEntry.
 */
wam.jsfs.dom.OpenContext.prototype.onDirError_ = function(error) {
  this.onWamError_(wam.jsfs.dom.convertDirError(error, this.path));
};

/**
 * Called directly by the parent wam.jsfs.dom.FileSystem to initiate the
 * open.
 */
wam.jsfs.dom.OpenContext.prototype.onOpen_ = function() {
  var onFileError = this.onFileError_.bind(this);
  var mode = this.openContextBinding.mode;

  var onStat = function(stat) {
    this.entry_.file(function(f) {
        this.file_ = f;
        this.openContextBinding.ready(stat);
      }.bind(this),
      onFileError);
  }.bind(this);

  var onFileFound = function(entry) {
    this.entry_ = entry;
    if (mode.write && mode.truncate) {
      this.entry_.createWriter(
          function(writer) {
            writer.truncate(0);
            wam.jsfs.dom.statEntry(entry, onStat, onFileError);
          },
          onFileError);
    } else {
      wam.jsfs.dom.statEntry(entry, onStat, onFileError);
    }
  }.bind(this);

  this.domfs_.root.getFile(
      this.path,
      {create: mode.create,
       exclusive: mode.exclusive
      },
      onFileFound, onFileError);
};

/**
 * Handle a seek event from the binding.
 */
wam.jsfs.dom.OpenContext.prototype.onSeek_ = function(arg, onSuccess, onError) {
  if (!this.seek_(arg, onError))
    return;

  onSuccess({position: this.position_});
};

/**
 * Handle a read event from the binding.
 */
wam.jsfs.dom.OpenContext.prototype.onRead_ = function(arg, onSuccess, onError) {
  if (!this.seek_(arg, onError))
    return;

  var fileSize = this.file_.size;
  var end;
  if (arg.count) {
    end = this.position_ + count;
  } else {
    end = fileSize;
  }

  var dataType = arg.dataType || 'utf8-string';
  var reader = new FileReader(this.entry_.file);

  reader.onload = function(e) {
    this.position_ = end + 1;
    var data = reader.result;

    if (dataType == 'base64-string') {
      // TODO: By the time we read this into a string the data may already have
      // been munged.  We need an ArrayBuffer->Base64 string implementation to
      // make this work for real.
      data = btoa(data);
    }

    onSuccess({dataType: dataType, data: data});
  }.bind(this);

  reader.onerror = function(error) {
    onError(wam.jsfs.dom.convertFileError(error, this.path));
  };

  var slice = this.file_.slice(this.position_, end);
  if (dataType == 'blob') {
    onSuccess({dataType: dataType, data: slice});
  } else if (dataType == 'arraybuffer') {
    reader.readAsArrayBuffer(slice);
  } else {
    reader.readAsText(slice);
  }
};

/**
 * Handle a write event from the binding.
 */
wam.jsfs.dom.OpenContext.prototype.onWrite_ = function(
    arg, onSuccess, onError) {
  if (!this.seek_(arg, onError))
    return;

  var onWriterReady = function(writer) {
    var blob;
    if (arg.data instanceof Blob) {
      blob = arg.data;
    } else if (arg.data instanceof ArrayBuffer) {
      blob = new Blob([arg.data], {type: 'application/octet-stream'});
    } else if (arg.dataType == 'base64-string') {
      // TODO: Once we turn this into a string the data may already have
      // been munged.  We need an ArrayBuffer->Base64 string implementation to
      // make this work for real.
      blob = new Blob([atob(arg.data)],  {type: 'application/octet-stream'});
    } else if (arg.dataType == 'utf8-string') {
      blob = new Blob([arg.data],  {type: 'text/plain'});
    } else if (arg.dataType == 'value') {
      blob = new Blob([JSON.stringify(arg.data)],  {type: 'text/json'});
    }

    writer.onerror = function(error) {
      onError(wam.jsfs.dom.convertFileError(error, this.path));
    }.bind(this);

    writer.onwrite = function() {
      this.position_ = this.position_ + blob.size;
      onSuccess(null);
    }.bind(this);

    writer.seek(this.position_);
    writer.write(blob);
  };

  this.entry_.createWriter(
      onWriterReady,
      this.onFileError_.bind(this),
      function(error) {
        onError(wam.jsfs.dom.convertFileError(error, this.path));
      });
};
