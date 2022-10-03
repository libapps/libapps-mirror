// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview extern settings for WASI structures.
 * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md
 * @externs
 */

/**
 * We don't use the WASI name here as it confuses closure-compiler when we
 * import the WASI namespace from js/wasi.js.  If we could make them work
 * together, it'd be better to have a single name.
 *
 * @const
 */
var WASI_t = {};

/** @typedef {number} */
WASI_t.u8;

/** @typedef {number} */
WASI_t.u16;

/** @typedef {number} */
WASI_t.u32;

/** @typedef {bigint} */
WASI_t.s64;

/** @typedef {bigint} */
WASI_t.u64;

/** @enum {!WASI_t.u8} */
WASI_t.advice = {
  DONTNEED: 0,
  NOREUSE: 0,
  NORMAL: 0,
  RANDOM: 0,
  SEQUENTIAL: 0,
  WILLNEED: 0,
};

/** @enum {!WASI_t.u32} */
WASI_t.clockid = {
  MONOTONIC: 0,
  PROCESS_CPUTIME_ID: 0,
  REALTIME: 0,
  THREAD_CPUTIME_ID: 0,
};

/** @typedef {!WASI_t.u64} */
WASI_t.device;

/** @typedef {!WASI_t.u64} */
WASI_t.dircookie;

/** @typedef {!WASI_t.u32} */
WASI_t.dirnamlen;

/** @typedef {!WASI_t.u16} */
WASI_t.errno;

/** @enum {!WASI_t.u16} */
WASI_t.eventrwflags = {
  FD_READWRITE_HANGUP: 0,
};

/** @enum {!WASI_t.u8} */
WASI_t.eventtype = {
  CLOCK: 0,
  FD_READ: 0,
  FD_WRITE: 0,
};

/** @typedef {!WASI_t.u32} */
WASI_t.exitcode;

/** @typedef {!WASI_t.u32} */
WASI_t.fd;

/** @enum {!WASI_t.u16} */
WASI_t.fdflags = {
  APPEND: 0,
  DSYNC: 0,
  NONBLOCK: 0,
  RSYNC: 0,
  SYNC: 0,
};

/** @typedef {!WASI_t.s64} */
WASI_t.filedelta;

/** @typedef {!WASI_t.u64} */
WASI_t.filesize;

/** @enum {!WASI_t.u8} */
WASI_t.filetype = {
  BLOCK_DEVICE: 0,
  CHARACTER_DEVICE: 0,
  DIRECTORY: 0,
  REGULAR_FILE: 0,
  SOCKET_DGRAM: 0,
  SOCKET_STREAM: 0,
  SYMBOLIC_LINK: 0,
  UNKNOWN: 0,
};

/** @enum {!WASI_t.u16} */
WASI_t.fstflags = {
  ATIM: 0,
  ATIM_NOW: 0,
  MTIM: 0,
  MTIM_NOW: 0,
};

/** @typedef {!WASI_t.u64} */
WASI_t.inode;

/** @typedef {!WASI_t.u64} */
WASI_t.linkcount;

/** @enum {!WASI_t.u32} */
WASI_t.lookupflags = {
  SYMLINK_FOLLOW: 0,
};

/** @enum {!WASI_t.u16} */
WASI_t.oflags = {
  CREAT: 0,
  DIRECTORY: 0,
  EXCL: 0,
  TRUNC: 0,
};

/** @typedef {!WASI_t.u32} */
WASI_t.pointer;

/** @enum {!WASI_t.u8} */
WASI_t.preopentype = {
  DIR: 0,
};

/** @typedef {!WASI_t.u16} */
WASI_t.riflags;

/** @typedef {!WASI_t.u64} */
WASI_t.rights;

/** @typedef {!WASI_t.u16} */
WASI_t.roflags;

/** @enum {!WASI_t.u8} */
WASI_t.sdflags = {
  RD: 0,
  RW: 0,
};

/** @typedef {!WASI_t.u16} */
WASI_t.siflags;

/** @typedef {!WASI_t.u8} */
WASI_t.signal;

/** @typedef {!WASI_t.u32} */
WASI_t.size;

/** @enum {!WASI_t.u16} */
WASI_t.subclockflags = {
  SUBSCRIPTION_CLOCK_ABSTIME: 0,
};

/** @typedef {!WASI_t.u64} */
WASI_t.timestamp;

/** @typedef {!WASI_t.u64} */
WASI_t.userdata;

/** @enum {!WASI_t.u8} */
WASI_t.whence = {
  SET: 0,
  CUR: 0,
  END: 0,
};

/**
 * @typedef {{
 *   struct_size: (number|undefined),
 *   d_next: WASI_t.dircookie,
 *   d_ino: WASI_t.inode,
 *   d_namlen: WASI_t.dirnamlen,
 *   d_type: WASI_t.filetype,
 * }}
 */
WASI_t.dirent;

/**
 * @typedef {{
 *   struct_size: number,
 *   nbytes: WASI_t.filesize,
 *   flags: WASI_t.eventrwflags,
 * }}
 */
WASI_t.event_fd_readwrite;

/**
 * @typedef {{
 *   struct_size: number,
 *   userdata: WASI_t.userdata,
 *   error: WASI_t.errno,
 *   type: WASI_t.eventtype,
 *   fd_readwrite: WASI_t.event_fd_readwrite,
 * }}
 */
WASI_t.event;

/**
 * @typedef {{
 *   struct_size: number,
 *   fs_filetype: WASI_t.filetype,
 *   fs_flags: WASI_t.fdflags,
 *   fs_rights_base: WASI_t.rights,
 *   fs_rights_inheriting: WASI_t.rights,
 * }}
 */
WASI_t.fdstat;

/**
 * @typedef {{
 *   struct_size: number,
 *   dev: WASI_t.device,
 *   ino: WASI_t.inode,
 *   filetype: WASI_t.filetype,
 *   nlink: WASI_t.linkcount,
 *   size: WASI_t.filesize,
 *   atim: WASI_t.timestamp,
 *   mtim: WASI_t.timestamp,
 *   ctim: WASI_t.timestamp,
 * }}
 */
WASI_t.filestat;

/**
 * @typedef {{
 *   struct_size: number,
 *   buf: WASI_t.pointer,
 *   buf_len: WASI_t.size,
 * }}
 */
WASI_t.iovec;

/**
 * @typedef {{
 *   struct_size: number,
 *   pr_name_len: WASI_t.size,
 * }}
 */
WASI_t.prestat_dir;

/**
 * @typedef {{
 *   struct_size: number,
 *   id: WASI_t.clockid,
 *   timeout: WASI_t.timestamp,
 *   precision: WASI_t.timestamp,
 *   flags: WASI_t.subclockflags,
 * }}
 */
WASI_t.subscription_clock;

/**
 * @typedef {{
 *   struct_size: number,
 *   file_descriptor: WASI_t.fd,
 * }}
 */
WASI_t.subscription_fd_readwrite;

/**
 * @typedef {{
 *   struct_size: number,
 *   userdata: WASI_t.userdata,
 *   tag: WASI_t.eventtype,
 *   clock: (WASI_t.subscription_clock|undefined),
 *   fd_read: (WASI_t.subscription_fd_readwrite|undefined),
 *   fd_write: (WASI_t.subscription_fd_readwrite|undefined),
 * }}
 */
WASI_t.subscription;
