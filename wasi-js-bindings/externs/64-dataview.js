// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview DataView supporting WASI structures.
 * @externs
 */

/**
 * DataView with methods for working with WASI structures.
 *
 * @interface
 */
class WasiViewInterface {
  /**
   * Read file/memory advisory information.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#advice
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.advice}
   */
  getAdvice(byteOffset, littleEndian = false) {}

  /**
   * Write file/memory advisory information.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#advice
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.advice} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setAdvice(byteOffset, value, littleEndian = false) {}

  /**
   * Read clock identifiers.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#clockid
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.clockid}
   */
  getClockid(byteOffset, littleEndian = false) {}

  /**
   * Write clock identifiers.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#clockid
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.clockid} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setClockid(byteOffset, value, littleEndian = false) {}

  /**
   * Read device identifiers.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#device
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.device}
   */
  getDevice(byteOffset, littleEndian = false) {}

  /**
   * Write device identifiers.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#device
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.device} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setDevice(byteOffset, value, littleEndian = false) {}

  /**
   * Read a directory cookie.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#dircookie
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.dircookie}
   */
  getDircookie(byteOffset, littleEndian = false) {}

  /**
   * Write a directory cookie.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#dircookie
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.dircookie} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setDircookie(byteOffset, value, littleEndian = false) {}

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
   * Write a dirent structure.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#-dirent-struct
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.dirent} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setDirent(byteOffset, value, littleEndian = false) {}

  /**
   * Read a directory name entry.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#dirnamlen
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.dirnamlen}
   */
  getDirnamlen(byteOffset, littleEndian = false) {}

  /**
   * Write a directory name entry.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#dirnamlen
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.dirnamlen} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setDirnamlen(byteOffset, value, littleEndian = false) {}

  /**
   * Read an errno.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#errno
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.errno}
   */
  getErrno(byteOffset, littleEndian = false) {}

  /**
   * Write an errno.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#errno
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.errno} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setErrno(byteOffset, value, littleEndian = false) {}

  /**
   * Read an event structure.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#-event-struct
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.event}
   */
  getEvent(byteOffset, littleEndian = false) {}

  /**
   * Write an event structure.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#-event-struct
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.event} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setEvent(byteOffset, value, littleEndian = false) {}

  /**
   * Read an event_fd_readwrite structure.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#event_fd_readwrite
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.event_fd_readwrite}
   */
  getEventFdReadWrite(byteOffset, littleEndian = false) {}

  /**
   * Write an event_fd_readwrite structure.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#event_fd_readwrite
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.event_fd_readwrite} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setEventFdReadWrite(byteOffset, value, littleEndian = false) {}

  /**
   * Read event fd read/write flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#eventrwflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.eventrwflags}
   */
  getEventrwflags(byteOffset, littleEndian = false) {}

  /**
   * Write event fd read/write flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#eventrwflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.eventrwflags} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setEventrwflags(byteOffset, value, littleEndian = false) {}

  /**
   * Read an event type.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#eventtype
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.eventtype}
   */
  getEventtype(byteOffset, littleEndian = false) {}

  /**
   * Write an event type.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#eventtype
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.eventtype} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setEventtype(byteOffset, value, littleEndian = false) {}

  /**
   * Read an exit code.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#exitcode
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.exitcode}
   */
  getExitcode(byteOffset, littleEndian = false) {}

  /**
   * Write an exit code.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#exitcode
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.exitcode} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setExitcode(byteOffset, value, littleEndian = false) {}

  /**
   * Read a file descriptor.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#fd
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.fd}
   */
  getFd(byteOffset, littleEndian = false) {}

  /**
   * Write a file descriptor.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#fd
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.fd} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setFd(byteOffset, value, littleEndian = false) {}

  /**
   * Read fd flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#fdflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.fdflags}
   */
  getFdflags(byteOffset, littleEndian = false) {}

  /**
   * Write fd flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#fdflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.fdflags} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setFdflags(byteOffset, value, littleEndian = false) {}

  /**
   * Read a fdstat structure.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#fdstat
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.fdstat}
   */
  getFdstat(byteOffset, littleEndian = false) {}

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
   * Read file size.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#filesize
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.filesize}
   */
  getFilesize(byteOffset, littleEndian = false) {}

  /**
   * Write file size.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#filesize
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.filesize} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setFilesize(byteOffset, value, littleEndian = false) {}

  /**
   * Read a filestat structure.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#filestat
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.filestat}
   */
  getFilestat(byteOffset, littleEndian = false) {}

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
   * Read a file type.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#filetype
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.filetype}
   */
  getFiletype(byteOffset, littleEndian = false) {}

  /**
   * Write a file type.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#filetype
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.filetype} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setFiletype(byteOffset, value, littleEndian = false) {}

  /**
   * Read file stat flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#fstflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.fstflags}
   */
  getFstflags(byteOffset, littleEndian = false) {}

  /**
   * Write file stat flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#fstflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.fstflags} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setFstflags(byteOffset, value, littleEndian = false) {}

  /**
   * Read an inode number.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#inode
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.inode}
   */
  getInode(byteOffset, littleEndian = false) {}

  /**
   * Write an inode number.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#inode
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.inode} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setInode(byteOffset, value, littleEndian = false) {}

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

  /**
   * Write an iovec/ciovec structure.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#-iovec-struct
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#-ciovec-struct
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.iovec} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setIovec(byteOffset, value, littleEndian = false) {}

  /**
   * Read link count.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#linkcount
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.linkcount}
   */
  getLinkcount(byteOffset, littleEndian = false) {}

  /**
   * Write link count.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#linkcount
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.linkcount} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setLinkcount(byteOffset, value, littleEndian = false) {}

  /**
   * Read directory lookup flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#lookupflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.lookupflags}
   */
  getLookupflags(byteOffset, littleEndian = false) {}

  /**
   * Write directory lookup flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#lookupflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.lookupflags} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setLookupflags(byteOffset, value, littleEndian = false) {}

  /**
   * Read path open flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#oflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.oflags}
   */
  getOflags(byteOffset, littleEndian = false) {}

  /**
   * Write path open flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#oflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.oflags} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setOflags(byteOffset, value, littleEndian = false) {}

  /**
   * Read a pointer address (not the target of the pointer!).
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#pointer
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.size}
   */
  getPointer(byteOffset, littleEndian = false) {}

  /**
   * Write a pointer address.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#pointer
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.size} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setPointer(byteOffset, value, littleEndian = false) {}

  /**
   * Read preopen type.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#preopentype
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.preopentype}
   */
  getPreopentype(byteOffset, littleEndian = false) {}

  /**
   * Write preopen type.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#preopentype
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.preopentype} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setPreopentype(byteOffset, value, littleEndian = false) {}

  /**
   * Read sock receive flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#riflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.riflags}
   */
  getRiflags(byteOffset, littleEndian = false) {}

  /**
   * Write sock receive flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#riflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.riflags} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setRiflags(byteOffset, value, littleEndian = false) {}

  /**
   * Read filesystem rights.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#rights
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.rights}
   */
  getRights(byteOffset, littleEndian = false) {}

  /**
   * Write filesystem rights.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#rights
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.rights} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setRights(byteOffset, value, littleEndian = false) {}

  /**
   * Read sock receive flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#roflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.roflags}
   */
  getRoflags(byteOffset, littleEndian = false) {}

  /**
   * Write sock receive flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#roflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.roflags} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setRoflags(byteOffset, value, littleEndian = false) {}

  /**
   * Read sock shutdown flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#sdflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.sdflags}
   */
  getSdflags(byteOffset, littleEndian = false) {}

  /**
   * Write sock shutdown flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#sdflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.sdflags} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setSdflags(byteOffset, value, littleEndian = false) {}

  /**
   * Read sock send flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#siflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.siflags}
   */
  getSiflags(byteOffset, littleEndian = false) {}

  /**
   * Write sock send flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#siflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.siflags} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setSiflags(byteOffset, value, littleEndian = false) {}

  /**
   * Read signal number.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#signal
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.signal}
   */
  getSignal(byteOffset, littleEndian = false) {}

  /**
   * Write signal number.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#signal
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.signal} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setSignal(byteOffset, value, littleEndian = false) {}

  /**
   * Read a size value.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#size
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.size}
   */
  getSize(byteOffset, littleEndian = false) {}

  /**
   * Write a size value.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#size
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.size} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setSize(byteOffset, value, littleEndian = false) {}

  /**
   * Read subclock flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#subclockflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.subclockflags}
   */
  getSubclockflags(byteOffset, littleEndian = false) {}

  /**
   * Write subclock flags.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#subclockflags
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.subclockflags} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setSubclockflags(byteOffset, value, littleEndian = false) {}

  /**
   * Read a subscription structure.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#subscription
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.subscription}
   */
  getSubscription(byteOffset, littleEndian = false) {}

  /**
   * Write a subscription structure.
   *
   * NB: Omitted for now out of laziness, and because no APIs need to write it.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#subscription
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.subscription} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  // setSubscription(byteOffset, value, littleEndian = false) {}

  /**
   * Read a subscription clock structure.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#subscription_clock
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.subscription_clock}
   */
  getSubscriptionClock(byteOffset, littleEndian = false) {}

  /**
   * Write a subscription clock structure.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#subscription_clock
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.subscription_clock} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setSubscriptionClock(byteOffset, value, littleEndian = false) {}

  /**
   * Read a subscription fd read/write structure.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#subscription_fd_readwrite
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.subscription_fd_readwrite}
   */
  getSubscriptionFdReadWrite(byteOffset, littleEndian = false) {}

  /**
   * Write a subscription fd read/write structure.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#subscription_fd_readwrite
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.subscription_fd_readwrite} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setSubscriptionFdReadWrite(byteOffset, value, littleEndian = false) {}

  /**
   * Read a timestamp.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#timestamp
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.timestamp}
   */
  getTimestamp(byteOffset, littleEndian = false) {}

  /**
   * Write a timestamp.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#timestamp
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.timestamp} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setTimestamp(byteOffset, value, littleEndian = false) {}

  /**
   * Read arbitrary userdata field.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#userdata
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.userdata}
   */
  getUserdata(byteOffset, littleEndian = false) {}

  /**
   * Write arbitrary userdata field.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#userdata
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.userdata} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setUserdata(byteOffset, value, littleEndian = false) {}

  /**
   * Read file offset mode.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#whence
   * @param {number} byteOffset Byte offset to the value.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   * @return {!WASI_t.whence}
   */
  getWhence(byteOffset, littleEndian = false) {}

  /**
   * Write file offset mode.
   *
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#whence
   * @param {number} byteOffset Byte offset to the value.
   * @param {!WASI_t.whence} value The value to write.
   * @param {boolean=} littleEndian Whether the value is LE instead of BE.
   */
  setWhence(byteOffset, value, littleEndian = false) {}
}

/** @implements {WasiViewInterface} */
class WasiView extends DataView {
  getAdvice(byteOffset, littleEndian = false) {}
  setAdvice(byteOffset, value, littleEndian = false) {}
  getClockid(byteOffset, littleEndian = false) {}
  setClockid(byteOffset, value, littleEndian = false) {}
  getDevice(byteOffset, littleEndian = false) {}
  setDevice(byteOffset, value, littleEndian = false) {}
  getDircookie(byteOffset, littleEndian = false) {}
  setDircookie(byteOffset, value, littleEndian = false) {}
  getDirent(byteOffset, littleEndian = false) {}
  setDirent(byteOffset, value, littleEndian = false) {}
  getDirnamlen(byteOffset, littleEndian = false) {}
  setDirnamlen(byteOffset, value, littleEndian = false) {}
  getErrno(byteOffset, littleEndian = false) {}
  setErrno(byteOffset, value, littleEndian = false) {}
  getEvent(byteOffset, littleEndian = false) {}
  setEvent(byteOffset, value, littleEndian = false) {}
  getEventFdReadWrite(byteOffset, littleEndian = false) {}
  setEventFdReadWrite(byteOffset, value, littleEndian = false) {}
  getEventrwflags(byteOffset, littleEndian = false) {}
  setEventrwflags(byteOffset, value, littleEndian = false) {}
  getEventtype(byteOffset, littleEndian = false) {}
  setEventtype(byteOffset, value, littleEndian = false) {}
  getExitcode(byteOffset, littleEndian = false) {}
  setExitcode(byteOffset, value, littleEndian = false) {}
  getFd(byteOffset, littleEndian = false) {}
  setFd(byteOffset, value, littleEndian = false) {}
  getFdflags(byteOffset, littleEndian = false) {}
  setFdflags(byteOffset, value, littleEndian = false) {}
  getFdstat(byteOffset, littleEndian = false) {}
  setFdstat(byteOffset, value, littleEndian = false) {}
  getFilesize(byteOffset, littleEndian = false) {}
  setFilesize(byteOffset, value, littleEndian = false) {}
  getFilestat(byteOffset, littleEndian = false) {}
  setFilestat(byteOffset, value, littleEndian = false) {}
  getFiletype(byteOffset, littleEndian = false) {}
  setFiletype(byteOffset, value, littleEndian = false) {}
  getFstflags(byteOffset, littleEndian = false) {}
  setFstflags(byteOffset, value, littleEndian = false) {}
  getInode(byteOffset, littleEndian = false) {}
  setInode(byteOffset, value, littleEndian = false) {}
  getIovec(byteOffset, littleEndian = false) {}
  setIovec(byteOffset, value, littleEndian = false) {}
  getLinkcount(byteOffset, littleEndian = false) {}
  setLinkcount(byteOffset, value, littleEndian = false) {}
  getLookupflags(byteOffset, littleEndian = false) {}
  setLookupflags(byteOffset, value, littleEndian = false) {}
  getOflags(byteOffset, littleEndian = false) {}
  setOflags(byteOffset, value, littleEndian = false) {}
  getPointer(byteOffset, littleEndian = false) {}
  setPointer(byteOffset, value, littleEndian = false) {}
  getPreopentype(byteOffset, littleEndian = false) {}
  setPreopentype(byteOffset, value, littleEndian = false) {}
  getRiflags(byteOffset, littleEndian = false) {}
  setRiflags(byteOffset, value, littleEndian = false) {}
  getRights(byteOffset, littleEndian = false) {}
  setRights(byteOffset, value, littleEndian = false) {}
  getRoflags(byteOffset, littleEndian = false) {}
  setRoflags(byteOffset, value, littleEndian = false) {}
  getSdflags(byteOffset, littleEndian = false) {}
  setSdflags(byteOffset, value, littleEndian = false) {}
  getSiflags(byteOffset, littleEndian = false) {}
  setSiflags(byteOffset, value, littleEndian = false) {}
  getSignal(byteOffset, littleEndian = false) {}
  setSignal(byteOffset, value, littleEndian = false) {}
  getSize(byteOffset, littleEndian = false) {}
  setSize(byteOffset, value, littleEndian = false) {}
  getSubclockflags(byteOffset, littleEndian = false) {}
  setSubclockflags(byteOffset, value, littleEndian = false) {}
  getSubscription(byteOffset, littleEndian = false) {}
  // setSubscription(byteOffset, value, littleEndian = false) {}
  getSubscriptionClock(byteOffset, littleEndian = false) {}
  setSubscriptionClock(byteOffset, value, littleEndian = false) {}
  getSubscriptionFdReadWrite(byteOffset, littleEndian = false) {}
  setSubscriptionFdReadWrite(byteOffset, value, littleEndian = false) {}
  getTimestamp(byteOffset, littleEndian = false) {}
  setTimestamp(byteOffset, value, littleEndian = false) {}
  getUserdata(byteOffset, littleEndian = false) {}
  setUserdata(byteOffset, value, littleEndian = false) {}
  getWhence(byteOffset, littleEndian = false) {}
  setWhence(byteOffset, value, littleEndian = false) {}
}
