// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview HTML5 FileSystem related utility functions.
 */

import {lib} from '../../libdot/index.js';

/**
 * Overwrite a file on an HTML5 filesystem.
 *
 * Replace the contents of a file with the string provided.  If the file
 * doesn't exist it is created.  If it does, it is removed and re-created.
 *
 * @param {!DirectoryEntry} root The directory to consider as the root of the
 *     path.
 * @param {string} path The path of the target file, relative to root.
 * @param {!ArrayBuffer|!Blob|string} contents The new contents of the file.
 * @return {!Promise<void>}
 */
export function overwriteFile(root, path, contents) {
  if (!(contents instanceof Blob)) {
    contents = new Blob([contents], {type: 'text/plain'});
  }

  return removeFile(root, path)
    .catch(() => {})
    .then(() => getOrCreateFile(root, path))
    .then((fileEntry) => new Promise((resolve, reject) => {
      fileEntry.createWriter((writer) => {
        writer.onwriteend = resolve;
        writer.onerror = reject;
        writer.write(contents);
      }, reject);
    }));
}

/**
 * Open a file on an HTML5 filesystem.
 *
 * @param {!DirectoryEntry} root The directory to consider as the root of the
 *     path.
 * @param {string} path The path of the target file, relative to root.
 * @return {!Promise<!File>} The open file handle.
 */
export function openFile(root, path) {
  return new Promise((resolve, reject) => {
    root.getFile(path, {create: false}, (fileEntry) => {
      fileEntry.file(resolve, reject);
    }, reject);
  });
}

/**
 * Read a file on an HTML5 filesystem.
 *
 * @param {!DirectoryEntry} root The directory to consider as the root of the
 *     path.
 * @param {string} path The path of the target file, relative to root.
 * @return {!Promise<string>} The file content.
 */
export function readFile(root, path) {
  return openFile(root, path)
    .then((file) => file.text());
}

/**
 * Remove a file from an HTML5 filesystem.
 *
 * @param {!DirectoryEntry} root The directory to consider as the root of the
 *     path.
 * @param {string} path The path of the target file, relative to root.
 * @return {!Promise<void>}
 */
export function removeFile(root, path) {
  return new Promise((resolve, reject) => {
    root.getFile(path, {}, (f) => f.remove(resolve, reject), reject);
  });
}

/**
 * Build a list of all FileEntrys in an HTML5 filesystem.
 *
 * @param {!DirectoryEntry} root The directory to consider as the root of the
 *     path.
 * @param {string} path The path of the target file, relative to root.
 * @return {!Promise<!Array<!Entry>>} All the entries in the
 *     directory.
 */
export function readDirectory(root, path) {
  return new Promise((resolve, reject) => {
    root.getDirectory(path, {create: false}, (dirEntry) => {
      const reader = dirEntry.createReader();
      reader.readEntries(resolve, reject);
    }, reject);
  });
}

/**
 * Locate the file referred to by path, creating directories or the file
 * itself if necessary.
 *
 * @param {!DirectoryEntry} root The directory to consider as the root of the
 *     path.
 * @param {string} path The path of the target file, relative to root.
 * @return {!Promise<!FileEntry>}
 */
export function getOrCreateFile(root, path) {
  let dirname = null;
  let basename = null;

  function onDirFound(dirEntry) {
    return new Promise((resolve, reject) => {
      dirEntry.getFile(lib.notNull(basename), {create: true}, resolve, reject);
    });
  }

  const i = path.lastIndexOf('/');
  if (i > -1) {
    dirname = path.substr(0, i);
    basename = path.substr(i + 1);
  } else {
    basename = path;
  }

  if (!dirname) {
    return onDirFound(root);
  }

  return getOrCreateDirectory(root, dirname).then(onDirFound);
}

/**
 * Locate the directory referred to by path, creating directories along the
 * way.
 *
 * @param {!DirectoryEntry} root The directory to consider as the root of the
 *     path.
 * @param {string} path The path of the target file, relative to root.
 * @return {!Promise<!DirectoryEntry>}
 */
export function getOrCreateDirectory(root, path) {
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
}
