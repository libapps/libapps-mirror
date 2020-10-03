// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview DataView supporting WASI structures.
 */

/**
 * DataView with methods for working with WASI structures.
 */
export class WasiView extends DataView {
  /**
   * Read a dirent structure.
   *
   * https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#-dirent-struct
   */
  getDirent(byteOffset, littleEndian = false) {
    /*
     * typedef struct __wasi_dirent_t {
     *   __wasi_dircookie_t d_next;  u64
     *   __wasi_inode_t d_ino;       u64
     *   uint32_t d_namlen;          u32
     *   __wasi_filetype_t d_type;   u8
     *   <pad>                       u8
     *   <pad>                       u16
     * } __wasi_dirent_t;
     */
    return {
      d_next: this.getBigUint64(byteOffset, littleEndian),
      d_ino: this.getBigUint64(byteOffset + 8, littleEndian),
      d_namelen: this.getUint32(byteOffset + 16, littleEndian),
      d_type: this.getUint8(byteOffset + 20, littleEndian),
      length: 24,
    };
  }

  /**
   * Write a fdstat structure.
   *
   * https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#fdstat
   */
  setFdstat(byteOffset, value, littleEndian = false) {
    /*
     * typedef struct __wasi_fdstat_t {
     *   __wasi_filetype_t fs_filetype;         u8
     *   <pad>                                  u8
     *   __wasi_fdflags_t fs_flags;             u16
     *   <pad>                                  u32
     *   __wasi_rights_t fs_rights_base;        u64
     *   __wasi_rights_t fs_rights_inheriting;  u64
     * } __wasi_fdstat_t;
     */
    this.setUint8(byteOffset, value.filetype, littleEndian);
    this.setUint16(byteOffset + 2, 0, littleEndian);
    this.setBigUint64(byteOffset + 8, value.rights_base, littleEndian);
    this.setBigUint64(byteOffset + 16, value.rights_inheriting, littleEndian);
  }

  /**
   * Write a filestat structure.
   *
   * https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#filestat
   */
  setFilestat(byteOffset, value, littleEndian = false) {
    /*
     * typedef struct __wasi_filestat_t {
     *   __wasi_device_t st_dev;         u64
     *   __wasi_inode_t st_ino;          u64
     *   __wasi_filetype_t st_filetype;  u8
     *   <pad>                           u8
     *   __wasi_linkcount_t st_nlink;    u32
     *   __wasi_filesize_t st_size;      u64
     *   __wasi_timestamp_t st_atim;     u64
     *   __wasi_timestamp_t st_mtim;     u64
     *   __wasi_timestamp_t st_ctim;     u64
     * } __wasi_filestat_t;
     */
  }

  /**
   * Read an iovec/ciovec structure.
   *
   * https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#-iovec-struct
   * https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#-ciovec-struct
   */
  getIovec(byteOffset, littleEndian = false) {
    /*
     * typedef struct __wasi_iovec_t {
     *   void *buf;       u32
     *   size_t buf_len;  u32
     * } __wasi_iovec_t;
     */
    return {
      buf: this.getUint32(byteOffset, littleEndian),
      buf_len: this.getUint32(byteOffset + 4, littleEndian),
      length: 8,
    };
  }
}
