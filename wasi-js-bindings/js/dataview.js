// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview DataView supporting WASI structures.
 */

import * as WASI from './wasi.js';

/**
 * DataView with methods for working with WASI structures.
 *
 * @implements {WasiViewInterface}
 */
export class WasiView extends DataView {
  /**
   * Helper for reading out a packed structure.
   *
   * @suppress {checkTypes} Closure doesn't like the this[] lookup.
   * @param {!Object} spec A specification for the structure to process.
   * @param {number} byteOffset Byte offset into the buffer to process.
   * @param {boolean=} littleEndian The endian of this structure.
   * @return {!Object} The structure read out.
   */
  get_(spec, byteOffset, littleEndian = false) {
    const ret = {struct_size: spec.struct_size};
    for (const [name, field] of Object.entries(spec.fields)) {
      ret[name] = this[`get${field.type}`](
          byteOffset + field.offset, littleEndian);
    }
    return ret;
  }

  /**
   * Helper for writing out a packed structure.
   *
   * @suppress {checkTypes} Closure doesn't like the this[] lookup.
   * @param {!Object} spec A specification for the structure to process.
   * @param {number} byteOffset Byte offset into the buffer to process.
   * @param {!Object} value The structure to write out.
   * @param {boolean=} littleEndian The endian of this structure.
   */
  set_(spec, byteOffset, value, littleEndian = false) {
    for (const [name, field] of Object.entries(spec.fields)) {
      this[`set${field.type}`](
          byteOffset + field.offset, value[name], littleEndian);
    }
  }

  /** @override */
  getDirent(byteOffset, littleEndian = false) {
    return /** @type {!WASI_t.dirent} */ (
        this.get_(WasiView.dirent_t, byteOffset, littleEndian));
  }

  /** @override */
  setDirent(byteOffset, value, littleEndian = false) {
    this.set_(WasiView.dirent_t, byteOffset, value, littleEndian);
  }

  /** @override */
  getEvent(byteOffset, littleEndian = false) {
    return /** @type {!WASI_t.event} */ (
        this.get_(WasiView.event_t, byteOffset, littleEndian));
  }

  /** @override */
  setEvent(byteOffset, value, littleEndian = false) {
    this.set_(WasiView.event_t, byteOffset, value, littleEndian);
  }

  /** @override */
  getEventFdReadWrite(byteOffset, littleEndian = false) {
    return /** @type {!WASI_t.event_fd_readwrite} */ (
        this.get_(WasiView.event_fd_readwrite_t, byteOffset, littleEndian));
  }

  /** @override */
  setEventFdReadWrite(byteOffset, value, littleEndian = false) {
    this.set_(WasiView.event_fd_readwrite_t, byteOffset, value, littleEndian);
  }

  /** @override */
  getFdstat(byteOffset, littleEndian = false) {
    return /** @type {!WASI_t.fdstat} */ (
        this.get_(WasiView.fdstat_t, byteOffset, littleEndian));
  }

  /** @override */
  setFdstat(byteOffset, value, littleEndian = false) {
    this.set_(WasiView.fdstat_t, byteOffset, value, littleEndian);
  }

  /** @override */
  getFilestat(byteOffset, littleEndian = false) {
    return /** @type {!WASI_t.filestat} */ (
        this.get_(WasiView.filestat_t, byteOffset, littleEndian));
  }

  /** @override */
  setFilestat(byteOffset, value, littleEndian = false) {
    this.set_(WasiView.filestat_t, byteOffset, value, littleEndian);
  }

  /** @override */
  getIovec(byteOffset, littleEndian = false) {
    return /** @type {!WASI_t.iovec} */ (
        this.get_(WasiView.iovec_t, byteOffset, littleEndian));
  }

  /** @override */
  setIovec(byteOffset, value, littleEndian = false) {
    this.set_(WasiView.iovec_t, byteOffset, value, littleEndian);
  }

  /** @override */
  getSubscriptionClock(byteOffset, littleEndian = false) {
    return /** @type {!WASI_t.subscription_clock} */ (
        this.get_(WasiView.subscription_clock_t, byteOffset, littleEndian));
  }

  /** @override */
  setSubscriptionClock(byteOffset, value, littleEndian = false) {
    this.set_(WasiView.subscription_clock_t, byteOffset, value, littleEndian);
  }

  /** @override */
  getSubscriptionFdReadWrite(byteOffset, littleEndian = false) {
    return /** @type {!WASI_t.subscription_fd_readwrite} */ (
        this.get_(WasiView.subscription_fd_readwrite_t, byteOffset,
                  littleEndian));
  }

  /** @override */
  setSubscriptionFdReadWrite(byteOffset, value, littleEndian = false) {
    this.set_(WasiView.subscription_fd_readwrite_t, byteOffset, value,
              littleEndian);
  }

  /** @override */
  getSubscription(byteOffset, littleEndian = false) {
    const ret = {
      userdata: this.getBigUint64(byteOffset, littleEndian),
      tag: /** @type {!WASI_t.eventtype} */ (this.getUint8(byteOffset + 8)),
      struct_size: 48,
    };
    switch (ret.tag) {
      case WASI.eventtype.CLOCK:
        ret.clock = this.getSubscriptionClock(byteOffset + 16, littleEndian);
        break;
      case WASI.eventtype.FD_READ:
        ret.fd_read = this.getSubscriptionFdReadWrite(
            byteOffset + 16, littleEndian);
        break;
      case WASI.eventtype.FD_WRITE:
        ret.fd_write = this.getSubscriptionFdReadWrite(
            byteOffset + 16, littleEndian);
        break;
      default:
        throw new Error(`Unknown tag ${ret.tag}`);
    }
    return ret;
  }

  /**
   * These stub methods are here to keep closure-compiler happy.  We hot patch
   * the methods in below via WasiView.typedefs.  We can clean this up if/when
   * JS supports class fields.
   */
  /* eslint-disable lines-between-class-members */
  /** @override */ getAdvice() {}
  /** @override */ setAdvice() {}
  /** @override */ getClockid() {}
  /** @override */ setClockid() {}
  /** @override */ getDevice() {}
  /** @override */ setDevice() {}
  /** @override */ getDircookie() {}
  /** @override */ setDircookie() {}
  /** @override */ getDirnamlen() {}
  /** @override */ setDirnamlen() {}
  /** @override */ getErrno() {}
  /** @override */ setErrno() {}
  /** @override */ getEventrwflags() {}
  /** @override */ setEventrwflags() {}
  /** @override */ getEventtype() {}
  /** @override */ setEventtype() {}
  /** @override */ getExitcode() {}
  /** @override */ setExitcode() {}
  /** @override */ getFd() {}
  /** @override */ setFd() {}
  /** @override */ getFdflags() {}
  /** @override */ setFdflags() {}
  /** @override */ getFilesize() {}
  /** @override */ setFilesize() {}
  /** @override */ getFiletype() {}
  /** @override */ setFiletype() {}
  /** @override */ getFstflags() {}
  /** @override */ setFstflags() {}
  /** @override */ getInode() {}
  /** @override */ setInode() {}
  /** @override */ getLinkcount() {}
  /** @override */ setLinkcount() {}
  /** @override */ getLookupflags() {}
  /** @override */ setLookupflags() {}
  /** @override */ getOflags() {}
  /** @override */ setOflags() {}
  /** @override */ getPointer() {}
  /** @override */ setPointer() {}
  /** @override */ getPreopentype() {}
  /** @override */ setPreopentype() {}
  /** @override */ getRiflags() {}
  /** @override */ setRiflags() {}
  /** @override */ getRights() {}
  /** @override */ setRights() {}
  /** @override */ getRoflags() {}
  /** @override */ setRoflags() {}
  /** @override */ getSdflags() {}
  /** @override */ setSdflags() {}
  /** @override */ getSiflags() {}
  /** @override */ setSiflags() {}
  /** @override */ getSignal() {}
  /** @override */ setSignal() {}
  /** @override */ getSize() {}
  /** @override */ setSize() {}
  /** @override */ getSubclockflags() {}
  /** @override */ setSubclockflags() {}
  /** @override */ getTimestamp() {}
  /** @override */ setTimestamp() {}
  /** @override */ getUserdata() {}
  /** @override */ setUserdata() {}
  /** @override */ getWhence() {}
  /** @override */ setWhence() {}
  /* eslint-enable lines-between-class-members */
}

/*
 * Move all these structures to class fields once JS supports it:
 * https://github.com/tc39/proposal-class-fields
 */

/**
 * These match the __wasi_*_t typedefs.
 *
 * @type {!Object<string, !Array<string>>}
 */
WasiView.typedefs = {
  'Uint8': [
    'Advice', 'Eventtype', 'Filetype', 'Preopentype', 'Sdflags', 'Signal',
    'Whence',
  ],
  'Uint16': [
    'Errno', 'Eventrwflags', 'Fdflags', 'Fstflags', 'Oflags', 'Riflags',
    'Roflags', 'Siflags', 'Subclockflags',
  ],
  'Uint32': [
    'Clockid', 'Dirnamlen', 'Exitcode', 'Fd', 'Lookupflags', 'Pointer', 'Size',
  ],
  'BigUint64': [
    'Device', 'Dircookie', 'Filesize', 'Inode', 'Linkcount', 'Rights',
    'Timestamp', 'Userdata',
  ],
};
Object.entries(WasiView.typedefs).forEach(([type, wasiTypes]) => {
  wasiTypes.forEach((wasiType) => {
    WasiView.prototype[`get${wasiType}`] = DataView.prototype[`get${type}`];
    WasiView.prototype[`set${wasiType}`] = DataView.prototype[`set${type}`];
  });
});

/*
 * typedef struct __wasi_dirent_t {
 *   __wasi_dircookie_t d_next;
 *   __wasi_inode_t d_ino;
 *   __wasi_dirnamlen_t d_namlen;
 *   __wasi_filetype_t d_type;
 * } __wasi_dirent_t;
 */
WasiView.dirent_t = {
  fields: {
    d_next: {offset: 0, type: 'Dircookie'},
    d_ino: {offset: 8, type: 'Inode'},
    d_namlen: {offset: 16, type: 'Dirnamlen'},
    d_type: {offset: 20, type: 'Filetype'},
  },
  struct_size: 24,
};

/*
 * typedef struct __wasi_event_t {
 *   __wasi_userdata_t userdata;
 *   __wasi_errno_t error;
 *   __wasi_eventtype_t type;
 *   __wasi_event_fd_readwrite_t fd_readwrite;
 * } __wasi_event_t;
 */
WasiView.event_t = {
  fields: {
    userdata: {offset: 0, type: 'Userdata'},
    error: {offset: 8, type: 'Errno'},
    type: {offset: 10, type: 'Eventtype'},
    fd_readwrite: {offset: 16, type: 'EventFdReadWrite'},
  },
  struct_size: 32,
};

/*
 * typedef struct __wasi_event_fd_readwrite_t {
 *   __wasi_filesize_t nbytes;
 *   __wasi_eventrwflags_t flags;
 * } __wasi_event_fd_readwrite_t;
 */
WasiView.event_fd_readwrite_t = {
  fields: {
    nbytes: {offset: 0, type: 'Filesize'},
    flags: {offset: 8, type: 'Eventrwflags'},
  },
  struct_size: 16,
};

/*
 * typedef struct __wasi_fdstat_t {
 *   __wasi_filetype_t fs_filetype;
 *   __wasi_fdflags_t fs_flags;
 *   __wasi_rights_t fs_rights_base;
 *   __wasi_rights_t fs_rights_inheriting;
 * } __wasi_fdstat_t;
 */
WasiView.fdstat_t = {
  fields: {
    fs_filetype: {offset: 0, type: 'Filetype'},
    fs_flags: {offset: 2, type: 'Fdflags'},
    fs_rights_base: {offset: 8, type: 'Rights'},
    fs_rights_inheriting: {offset: 16, type: 'Rights'},
  },
  struct_size: 24,
};

/*
 * typedef struct __wasi_filestat_t {
 *   __wasi_device_t dev;
 *   __wasi_inode_t ino;
 *   __wasi_filetype_t filetype;
 *   __wasi_linkcount_t nlink;
 *   __wasi_filesize_t size;
 *   __wasi_timestamp_t atim;
 *   __wasi_timestamp_t mtim;
 *   __wasi_timestamp_t ctim;
 * } __wasi_filestat_t;
 */
WasiView.filestat_t = {
  fields: {
    dev: {offset: 0, type: 'Device'},
    ino: {offset: 8, type: 'Inode'},
    filetype: {offset: 16, type: 'Filetype'},
    nlink: {offset: 24, type: 'Linkcount'},
    size: {offset: 32, type: 'Filesize'},
    atim: {offset: 40, type: 'Timestamp'},
    mtim: {offset: 48, type: 'Timestamp'},
    ctim: {offset: 56, type: 'Timestamp'},
  },
  struct_size: 64,
};

/*
 * typedef struct __wasi_iovec_t {
 *   void *buf;
 *   size_t buf_len;
 * } __wasi_iovec_t;
 */
WasiView.ciovec_t =
WasiView.iovec_t = {
  fields: {
    buf: {offset: 0, type: 'Pointer'},
    buf_len: {offset: 4, type: 'Size'},
  },
  struct_size: 8,
};

/*
 * typedef struct __wasi_subscription_clock_t {
 *   __wasi_clockid_t id;
 *   __wasi_timestamp_t timeout;
 *   __wasi_timestamp_t precision;
 *   __wasi_subclockflags_t flags;
 * } __wasi_subscription_clock_t;
 */
WasiView.subscription_clock_t = {
  fields: {
    id: {offset: 0, type: 'Clockid'},
    timeout: {offset: 8, type: 'Timestamp'},
    precision: {offset: 16, type: 'Timestamp'},
    flags: {offset: 24, type: 'Subclockflags'},
  },
  struct_size: 32,
};

/*
 * typedef struct __wasi_subscription_fd_readwrite_t {
 *   __wasi_fd_t file_descriptor;
 * } __wasi_subscription_fd_readwrite_t;
 */
WasiView.subscription_fd_readwrite_t = {
  fields: {
    file_descriptor: {offset: 0, type: 'Fd'},
  },
  struct_size: 4,
};
