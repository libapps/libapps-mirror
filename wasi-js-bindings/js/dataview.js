// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview DataView supporting WASI structures.
 */

/**
 * DataView with methods for working with WASI structures.
 *
 * @implements {WasiViewInterface}
 */
export class WasiView extends DataView {
  /** @override */
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
      d_namlen: this.getUint32(byteOffset + 16, littleEndian),
      d_type: /** @type {!WASI_t.filetype} */ (this.getUint8(byteOffset + 20)),
      struct_size: 24,
    };
  }

  /**
   * @override
   * @suppress {checkTypes} https://github.com/google/closure-compiler/commit/ee80bed57fe1ee93876fee66ad77e025a345c7a7
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
    this.setUint8(byteOffset, value.fs_filetype);
    this.setUint16(byteOffset + 2, value.fs_flags, littleEndian);
    this.setBigUint64(byteOffset + 8, value.fs_rights_base, littleEndian);
    this.setBigUint64(byteOffset + 16, value.fs_rights_inheriting,
                      littleEndian);
  }

  /** @override */
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

  /** @override */
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
      struct_size: 8,
    };
  }
}
