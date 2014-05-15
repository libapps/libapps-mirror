// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Namespace for stuff related to the DOM FileSystem<->jsfs proxy layer.
 */
wam.jsfs.dom = {};

/**
 * Convert an HTML5 FileError object into an appropriate wam.FileSystem.Error
 * value.
 *
 * This should be used for errors that were raised in the context of a
 * FileEntry.
 *
 * @param {FileError} error
 * @param {string} path The path that this error relates to.
 */
wam.jsfs.dom.convertFileError = function(error, path) {
  if (error.name == 'TypeMismatchError')
    return wam.mkerr('wam.FileSystem.Error.NotOpenable', [path]);

  if (error.name == 'NotFoundError')
    return wam.mkerr('wam.FileSystem.Error.NotFound', [path]);

  if (error.name == 'PathExistsError')
    return wam.mkerr('wam.FileSystem.Error.PathExists', [path]);

  return wam.mkerr('wam.FileSystem.Error.RuntimeError', [error.name]);
};

/**
 * Convert an HTML5 FileError object into an appropriate wam.FileSystem.Error
 * value.
 *
 * This should be used for errors that were raised in the context of a
 * DirEntry.
 *
 * @param {FileError} error
 * @param {string} path The path that this error relates to.
 */
wam.jsfs.dom.convertDirError = function(error, path) {
  if (error.name == 'TypeMismatchError')
    return wam.mkerr('wam.FileSystem.Error.NotListable', [path]);

  return wam.jsfs.dom.convertFileError(error);
};

/**
 * Get an appropriate wam 'stat' value for the given HTML5 FileEntry or
 * DirEntry object.
 */
wam.jsfs.dom.statEntry = function(entry, onSuccess, onError) {
  var onMetadata = function(entry, metadata) {
    if (entry.isFile) {
      onSuccess({
        source: 'domfs',
        abilities: ['OPEN'],
        dataType: 'blob',
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
