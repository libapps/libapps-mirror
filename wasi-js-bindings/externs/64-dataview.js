// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview DataView supporting WASI structures.
 */

/**
 * DataView with methods for working with WASI structures.
 *
 * @interface
 */
class WasiViewInterface {
  /**
   * Read a dirent structure.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#-dirent-struct
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.dirent}
   */
  getDirent(byteOffset, littleEndian = false) {}

  /**
   * Write a fdstat structure.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#fdstat
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.fdstat} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setFdstat(byteOffset, value, littleEndian = false) {}

  /**
   * Write a filestat structure.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#filestat
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.filestat} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setFilestat(byteOffset, value, littleEndian = false) {}

  /**
   * Read an iovec/ciovec structure.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#-iovec-struct
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#-ciovec-struct
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.iovec}
   */
  getIovec(byteOffset, littleEndian = false) {}
}

/** @implements {WasiViewInterface} */
class WasiView extends DataView {
  getDirent(byteOffset, littleEndian = false) {}
  setFdstat(byteOffset, value, littleEndian = false) {}
  setFilestat(byteOffset, value, littleEndian = false) {}
  getIovec(byteOffset, littleEndian = false) {}
}
