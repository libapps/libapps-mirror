// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Externs definition for the File System Access API.
 * @see https://wicg.github.io/file-system-access/
 * @externs
 */

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemWritableFileStream
 */
class FileSystemWritableFileStream {
  /**
   * @param {!ArrayBuffer} data
   * @return {!Promise<void>}
   */
  async write(data) {}

  /**
   * @param {number} position
   * @return {!Promise<void>}
   */
  async seek(position) {}

  /**
   * @param {number} size
   * @return {!Promise<void>}
   */
  async truncate(size) {}

  /** @return {!Promise<void>} */
  async close() {}
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle
 */
class FileSystemFileHandle {
  /** @return {!Promise<!File>} */
  async getFile() {}

  /**
   * @param {!Object=} options
   * @return {!Promise<!FileSystemWritableFileStream>}
   */
  async createWritable(options) {}
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/window/showSaveFilePicker
 * @param {!Object=} options
 * @return {!Promise<!FileSystemFileHandle>}
 */
window.showSaveFilePicker = async function(options) {};

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle
 */
class FileSystemDirectoryHandle {
  /**
   * @param {string} name
   * @param {!Object=} options
   * @return {!Promise<!FileSystemFileHandle>}
   */
  async getFileHandle(name, options) {}

  /**
   * @return {!Array<string>}
   */
  keys() {}
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
 * @param {!Object=} options
 * @return {!Promise<!FileSystemDirectoryHandle>}
 */
window.showDirectoryPicker = async function(options) {};
