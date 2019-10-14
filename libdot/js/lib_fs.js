// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * HTML5 FileSystem related utility functions.
 */
lib.fs = {};

/**
 * Returns a function that console.log()'s its arguments, prefixed by |msg|.
 *
 * This is a useful utility function when working with the FileSystem's many
 * async, callbacktastic methods.
 *
 * * Use it when you don't think you care about a callback.  If it ever gets
 *   called, you get a log message that includes any parameters passed to the
 *   callback.
 *
 * * Use it as your "log a messages, then invoke this other method" pattern.
 *   Great for debugging or times when you want to log a message before
 *   invoking a callback passed in to your method.
 *
 * @template T
 * @param {string} msg The message prefix to use in the log.
 * @param {T=} callback A function to invoke after logging.
 * @return {T} The wrapper function to call.
 */
lib.fs.log = function(msg, callback) {
  return function(...args) {
    console.log(msg + ': ' + args.join(', '));
    if (callback) {
      callback.apply(null, args);
    }
  };
};

/**
 * Returns a function that console.error()'s its arguments, prefixed by |msg|.
 *
 * This is exactly like fs.log(), except the message in the JS console will
 * be styled as an error.  See fs.log() for some use cases.
 *
 * @template T
 * @param {string} msg The message prefix to use in the log.
 * @param {T=} callback A function to invoke after logging.
 * @return {T} The wrapper function to call.
 */
lib.fs.err = function(msg, callback) {
  return function(...args) {
    console.error(msg + ': ' + args.join(', '), lib.f.getStack());
    if (callback) {
      callback.apply(null, args);
    }
  };
};

/**
 * Overwrite a file on an HTML5 filesystem.
 *
 * Replace the contents of a file with the string provided.  If the file
 * doesn't exist it is created.  If it does, it is removed and re-created.
 *
 * @param {!DirectoryEntry} root The directory to consider as the root of the
 *     path.
 * @param {string} path The path of the target file, relative to root.
 * @param {!Blob|string} contents The new contents of the file.
 * @return {!Promise<void>}
 */
lib.fs.overwriteFile = function(root, path, contents) {
  if (!(contents instanceof Blob)) {
    contents = new Blob([contents], {type: 'text/plain'});
  }

  return lib.fs.removeFile(root, path)
    .catch(() => {})
    .then(() => lib.fs.getOrCreateFile(root, path))
    .then((fileEntry) => new Promise((resolve, reject) => {
      fileEntry.createWriter((writer) => {
        writer.onwriteend = resolve;
        writer.onerror = reject;
        writer.write(contents);
      }, reject);
    }));
};

/**
 * Open a file on an HTML5 filesystem.
 *
 * @param {!DirectoryEntry} root The directory to consider as the root of the
 *     path.
 * @param {string} path The path of the target file, relative to root.
 * @return {!Promise<!File>} The open file handle.
 */
lib.fs.openFile = function(root, path) {
  return new Promise((resolve, reject) => {
    root.getFile(path, {create: false}, (fileEntry) => {
      fileEntry.file(resolve, reject);
    }, reject);
  });
};

/**
 * Read a file on an HTML5 filesystem.
 *
 * @param {!DirectoryEntry} root The directory to consider as the root of the
 *     path.
 * @param {string} path The path of the target file, relative to root.
 * @return {!Promise<string>} The file content.
 */
lib.fs.readFile = function(root, path) {
  return lib.fs.openFile(root, path)
    .then((file) => {
      const reader = new lib.fs.FileReader();
      return reader.readAsText(file);
    });
};

/**
 * Remove a file from an HTML5 filesystem.
 *
 * @param {!DirectoryEntry} root The directory to consider as the root of the
 *     path.
 * @param {string} path The path of the target file, relative to root.
 * @return {!Promise<void>}
 */
lib.fs.removeFile = function(root, path) {
  return new Promise((resolve, reject) => {
    root.getFile(path, {}, (f) => f.remove(resolve, reject), reject);
  });
};

/**
 * Build a list of all FileEntrys in an HTML5 filesystem.
 *
 * @param {!DirectoryEntry} root The directory to consider as the root of the
 *     path.
 * @param {string} path The path of the target file, relative to root.
 * @return {!Promise<!Array<!Entry>>} All the entries in the
 *     directory.
 */
lib.fs.readDirectory = function(root, path) {
  return new Promise((resolve, reject) => {
    root.getDirectory(path, {create: false}, (dirEntry) => {
      const reader = dirEntry.createReader();
      reader.readEntries(resolve, reject);
    }, reject);
  });
};

/**
 * Locate the file referred to by path, creating directories or the file
 * itself if necessary.
 *
 * @param {!DirectoryEntry} root The directory to consider as the root of the
 *     path.
 * @param {string} path The path of the target file, relative to root.
 * @return {!Promise<!FileEntry>}
 */
lib.fs.getOrCreateFile = function(root, path) {
  var dirname = null;
  var basename = null;

  function onDirFound(dirEntry) {
    return new Promise((resolve, reject) => {
      dirEntry.getFile(lib.notNull(basename), {create: true}, resolve, reject);
    });
  }

  var i = path.lastIndexOf('/');
  if (i > -1) {
    dirname = path.substr(0, i);
    basename = path.substr(i + 1);
  } else {
    basename = path;
  }

  if (!dirname) {
    return onDirFound(root);
  }

  return lib.fs.getOrCreateDirectory(root, dirname).then(onDirFound);
};

/**
 * Locate the directory referred to by path, creating directories along the
 * way.
 *
 * @param {!DirectoryEntry} root The directory to consider as the root of the
 *     path.
 * @param {string} path The path of the target file, relative to root.
 * @return {!Promise<!DirectoryEntry>}
 */
lib.fs.getOrCreateDirectory = function(root, path) {
  const names = path.split('/');

  return new Promise((resolve, reject) => {
    function getOrCreateNextName(dir) {
      if (!names.length) {
        return resolve(dir);
      }

      const name = names.shift();
      if (!name || name == '.') {
        getOrCreateNextName(dir);
      } else {
        dir.getDirectory(name, {create: true}, getOrCreateNextName, reject);
      }
    }

    getOrCreateNextName(root);
  });
};

/**
 * A Promise API around the FileReader API.
 *
 * The FileReader API is old, so wrap its callbacks with a Promise.
 *
 * @constructor
 */
lib.fs.FileReader = function() {
};

/**
 * Internal helper for wrapping all the readAsXxx funcs.
 *
 * @param {!Blob} blob The blob of data to read.
 * @param {string} method The specific readAsXxx function to call.
 * @return {!Promise} A promise to resolve when reading finishes or fails.
 * @private
 */
lib.fs.FileReader.prototype.readAs_ = function(blob, method) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onabort = reader.onerror = () => reject(reader);
    reader[method](blob);
  });
};

/**
 * Wrapper around FileReader.readAsArrayBuffer.
 *
 * @param {!Blob} blob The blob of data to read.
 * @return {!Promise<!ArrayBuffer>} A promise to resolve when reading finishes
 *     or fails.
 */
lib.fs.FileReader.prototype.readAsArrayBuffer = function(blob) {
  return this.readAs_(blob, 'readAsArrayBuffer');
};

/**
 * Wrapper around FileReader.readAsBinaryString.
 *
 * @param {!Blob} blob The blob of data to read.
 * @return {!Promise<string>} A promise to resolve when reading finishes or
 *     fails.
 */
lib.fs.FileReader.prototype.readAsBinaryString = function(blob) {
  return this.readAs_(blob, 'readAsBinaryString');
};

/**
 * Wrapper around FileReader.readAsDataURL.
 *
 * @param {!Blob} blob The blob of data to read.
 * @return {!Promise<string>} A promise to resolve when reading finishes or
 *     fails.
 */
lib.fs.FileReader.prototype.readAsDataURL = function(blob) {
  return this.readAs_(blob, 'readAsDataURL');
};

/**
 * Wrapper around FileReader.readAsText.
 *
 * @param {!Blob} blob The blob of data to read.
 * @return {!Promise<string>} A promise to resolve when reading finishes or
 *     fails.
 */
lib.fs.FileReader.prototype.readAsText = function(blob) {
  return this.readAs_(blob, 'readAsText');
};
