// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Externs definitions for indexeddb-fs used in nassh.
 *
 * @externs
 */

var createFs$$module$js$nassh_deps_rollup = {};

/**
 * @param {!Object=} options
 * @return {!IndexeddbFs}
 */
createFs$$module$js$nassh_deps_rollup.createFs = function(options) {};

/** @enum {string} */
var IndexeddbFsEntryType = {
  DIRECTORY: 'directory',
  FILE: 'file',
};

class IndexeddbFsDirectoryEntry {
  constructor() {
    /** @type {number} */
    this.createdAt;
    /** @type {string}*/
    this.directory;
    /** @type {string} */
    this.fullPath;
    /** @type {boolean} */
    this.isRoot;
    /** @type {string} */
    this.name;
    /** @type {IndexeddbFsEntryType} */
    this.type;
  }
}

class IndexeddbFsFileEntry {
  constructor() {
    /** @type {number} */
    this.createdAt;
    /** @type {string}*/
    this.directory;
    /** @type {string} */
    this.fullPath;
    /** @type {string} */
    this.name;
    /** @type {IndexeddbFsEntryType} */
    this.type;
  }
}

class ReadDirectoryDecoratorOutput {
  constructor() {
    /** @type {!Array<!IndexeddbFsDirectoryEntry>} */
    this.directories;
    /** @type {number} */
    this.directoriesCount;
    /** @type {!Array<!IndexeddbFsFileEntry>} */
    this.files;
    /** @type {number} */
    this.filesCount;
    /** @type {boolean} */
    this.isEmpty;
  }
}

class IndexeddbFs {
  /**
   * @param {string} fullPath
   * @param {string} destinationPath
   * @return {!Promise<IndexeddbFsFileEntry>}
   */
  copyFile(fullPath, destinationPath) {}

  /**
   * @param {string} fullPath
   * @return {!Promise<IndexeddbFsDirectoryEntry>}
   */
  createDirectory(fullPath) {}

  /**
   * @param {string} fullPath
   * @return {!Promise<IndexeddbFsFileEntry|IndexeddbFsDirectoryEntry>}
   */
  details(fullPath) {}

  /**
   * @param {string} fullPath
   * @return {!Promise<IndexeddbFsDirectoryEntry>}
   */
  directoryDetails(fullPath) {}

  /**
   * @param {string} fullPath
   * @return {!Promise<boolean>}
   */
  exists(fullPath) {}

  /**
   * @param {string} fullPath
   * @return {!Promise<IndexeddbFsFileEntry>}
   */
  fileDetails(fullPath) {}

  /**
   * @param {string} fullPath
   * @return {!Promise<boolean>}
   */
  isDirectory(fullPath) {}

  /**
   * @param {string} fullPath
   * @return {!Promise<boolean>}
   */
  isFile(fullPath) {}

  /**
   * @param {string} fullPath
   * @param {string} destinationPath
   * @return {!Promise<IndexeddbFsFileEntry>}
   */
  moveFile(fullPath, destinationPath) {}

  /**
   * @param {string} fullPath
   * @return {!Promise<ReadDirectoryDecoratorOutput>}
   */
  readDirectory(fullPath) {}

  /**
   * @param {string} fullPath
   * @return {!Promise<!ArrayBuffer|string>}
   */
  readFile(fullPath) {}

  /**
   * @param {string} fullPath
   * @return {!Promise<void>}
   */
  remove(fullPath) {}

  /**
   * @param {string} fullPath
   * @return {!Promise<void>}
   */
  removeDirectory(fullPath) {}

  /**
   * @param {string} fullPath
   * @return {!Promise<void>}
   */
  removeFile(fullPath) {}

  /**
   * @param {string} fullPath
   * @param {string} newFilename
   * @return {!Promise<IndexeddbFsFileEntry>}
   */
  renameFile(fullPath, newFilename) {}

  /**
   * @param {string} fullPath
   * @param {!ArrayBuffer|string} data
   * @return {!Promise<!IndexeddbFsFileEntry>}
   */
  writeFile(fullPath, data) {}
}
