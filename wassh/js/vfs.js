// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Filesystem core APIs.
 * @suppress {moduleLoad}
 */

import {WASI} from '../../wasi-js-bindings/index.js';

/**
 * An abstraction for registering a handler for paths.
 *
 * This just contects the filesystem names (e.g. "/dev/null") with the class
 * that will handle actual filesystem operations on it.
 */
export class PathHandler {
  /**
   * @param {string} path The absolute path in the filesystem for this handler.
   * @param {!WASI_t.filetype=} filetype The WASI filetype.
   * @param {!typeof PathHandle=} handleCls The PathHandle class for handling
   *     open events.
   */
  constructor(path, filetype = WASI.filetype.UNKNOWN, handleCls = PathHandle) {
    this.path = path;
    this.filetype = filetype;
    this.handleCls = handleCls;
  }

  /** @override */
  toString() {
    return `${this.constructor.name}(${this.path}, type=${this.filetype})`;
  }

  /**
   * @param {string} oldPath The existing path to link.
   * @param {string} newPath The new path to create the link.
   * @return {!Promise<!WASI_t.errno>}
   */
  async link(oldPath, newPath) {
    return WASI.errno.EROFS;
  }

  /**
   * @param {string} path
   * @param {!WASI_t.fdflags} fs_flags
   * @param {!WASI_t.oflags} o_flags
   * @return {!Promise<!WASI_t.errno|!PathHandle>}
   */
  async open(path, fs_flags, o_flags) {
    if (path !== this.path) {
      return WASI.errno.ENOTDIR;
    }
    const ret = new this.handleCls(this.path, this.filetype);
    await ret.init();
    return ret;
  }

  /**
   * @param {string} oldPath The old path name.
   * @param {string} newPath The new path name.
   * @return {!Promise<!WASI_t.errno>}
   */
  async rename(oldPath, newPath) {
    return WASI.errno.EROFS;
  }

  /**
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#filestat
   * @return {!Promise<!WASI_t.filestat>}
   */
  async stat() {
    return /** @type {!WASI_t.filestat} */ ({
      filetype: this.filetype,
    });
  }

  /**
   * @param {string} path The path to remove.
   * @return {!Promise<!WASI_t.errno>}
   */
  async unlink(path) {
    return WASI.errno.EROFS;
  }
}

/**
 * An abstraction for an open file handle.
 */
export class PathHandle {
  constructor(path, filetype = WASI.filetype.UNKNOWN) {
    this.path = path;
    this.pos = 0n;
    this.filetype = filetype;
  }

  /** @override */
  toString() {
    return `${this.constructor.name}(${this.path}, type=${this.filetype}, ` +
        `pos=${this.pos})`;
  }

  async init() {}

  async close() {}

  /**
   * @param {!TypedArray} buf
   * @return {!Promise<!WASI_t.errno|{nwritten: number}>}
   */
  async write(buf) {
    return WASI.errno.EBADF;
  }

  /**
   * @param {!TypedArray} buf
   * @param {number|bigint} offset
   * @return {!Promise<!WASI_t.errno|{nwritten: number}>}
   */
  async pwrite(buf, offset) {
    return WASI.errno.EBADF;
  }

  /**
   * @param {number} length
   * @return {!Promise<!WASI_t.errno|
   *                   {buf: !Uint8Array, nread: number}|
   *                   {buf: !Uint8Array}|
   *                   {nread: number}>}
   */
  async read(length) {
    return WASI.errno.EBADF;
  }

  /**
   * @param {number} length
   * @param {number|bigint} offset
   * @return {!Promise<!WASI_t.errno|
   *                   {buf: !Uint8Array, nread: number}|
   *                   {buf: !Uint8Array}|
   *                   {nread: number}>}
   */
  async pread(length, offset) {
    return WASI.errno.EBADF;
  }

  /**
   * @return {!WASI_t.errno|{offset: (number|bigint)}}
   */
  tell() {
    return {offset: this.pos};
  }

  /**
   * @param {number|bigint} offset
   * @param {!WASI_t.whence} whence
   * @return {!WASI_t.errno|{newoffset: bigint}}
   */
  seek(offset, whence) {
    return WASI.errno.EBADF;
  }

  /**
   * @see https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md#fdstat
   * @return {!Promise<!WASI_t.fdstat>}
   */
  async stat() {
    return /** @type {!WASI_t.fdstat} */ ({
      fs_filetype: this.filetype,
      fs_flags: 0,
    });
  }
}

export class FileHandler extends PathHandler {}

export class FileHandle extends PathHandle {
  constructor(path, type = WASI.filetype.REGULAR_FILE) {
    super(path, type);
    this.data = new Uint8Array(0);
  }

  /** @override */
  async write(buf) {
    buf = new Uint8Array(buf);
    const ret = this.pwrite(buf, this.pos);
    this.pos += BigInt(buf.byteLength);
    return ret;
  }

  /** @override */
  async pwrite(buf, offset) {
    buf = new Uint8Array(buf);
    offset = Number(offset);
    if (this.data.length < offset + buf.length) {
      const data = new Uint8Array(offset + buf.length);
      data.set(this.data);
      this.data = data;
    }
    this.data.set(buf, offset);
    return {nwritten: buf.length};
  }

  /** @override */
  async read(length) {
    const ret = await this.pread(length, this.pos);
    this.pos += BigInt(ret.buf.length);
    return ret;
  }

  /** @override */
  async pread(length, offset) {
    length = Number(length);
    offset = Number(offset);
    return {buf: this.data.subarray(offset, offset + length)};
  }

  /** @override */
  tell() {
    return {offset: this.pos};
  }

  /** @override */
  seek(offset, whence) {
    let newoffset;
    switch (whence) {
      case WASI.whence.SET:
        newoffset = BigInt(offset);
        break;
      case WASI.whence.CUR:
        newoffset = this.pos + BigInt(offset);
        break;
      case WASI.whence.END:
        newoffset = BigInt(this.data.length + Number(offset));
        break;
      default:
        // Higher layers handled this, but make closure happy.
        return WASI.errno.EINVAL;
    }

    if (newoffset < 0) {
      return WASI.errno.EINVAL;
    }

    if (newoffset > this.data.length) {
      // If seeking beyond the end, zero pad it.
      const data = new Uint8Array(Number(newoffset));
      data.set(this.data);
      this.data = data;
    }

    this.pos = newoffset;
    return {newoffset: this.pos};
  }
}

export class DirectoryHandler extends PathHandler {
  constructor(path, type = WASI.filetype.DIRECTORY,
              handleCls = DirectoryHandle) {
    super(path, type, handleCls);
  }

  /** @override */
  async open(path, fs_flags, o_flags) {
    if (path !== this.path) {
      const ret = new FileHandle(path);
      await ret.init();
      return ret;
    }
    return PathHandler.prototype.open.call(this, path, fs_flags, o_flags);
  }
}

export class DirectoryHandle extends PathHandle {
  constructor(path) {
    super(path, WASI.filetype.DIRECTORY);
  }

  /** @override */
  async write(buf) {
    return WASI.errno.EISDIR;
  }

  /** @override */
  async pwrite(buf, offset) {
    return WASI.errno.EISDIR;
  }

  /** @override */
  async read(length) {
    return WASI.errno.EISDIR;
  }
}

/**
 * A directory handler backed by indexeddb-fs.
 */
export class IndexeddbFsDirectoryHandler extends DirectoryHandler {
  /**
   * @override
   * @param {string} path
   * @param {?IndexeddbFs} fileSystem
   */
  constructor(path, fileSystem) {
    super(path, WASI.filetype.DIRECTORY, IndexeddbFsDirectoryHandle);
    this.fs_ = fileSystem;
  }

  /** @override */
  async link(oldPath, newPath) {
    // This isn't an actual link, but it works well enough for what OpenSSH
    // needs -- a basic copy.
    try {
      await this.fs_.copyFile(oldPath, newPath);
      return WASI.errno.ESUCCESS;
    } catch (e) {
      return WASI.errno.ENOENT;
    }
  }

  /** @override */
  async open(path, fs_flags, o_flags) {
    if (path !== this.path) {
      let details = null;
      try {
        details = await this.fs_.details(path);
      } catch (e) { /**/ }
      const exists = (details !== null);
      let doTruncate = (exists && o_flags & WASI.oflags.TRUNC);

      // Make sure directory settings match.
      if (o_flags & WASI.oflags.DIRECTORY) {
        if (!exists) {
          return WASI.oflags.EEXIST;
        } else if (details.type !== 'directory') {
          return WASI.oflags.ENOTDIR;
        }
      } else {
        if (exists && details.type === 'directory') {
          return WASI.oflags.EISDIR;
        }
      }

      // Make sure create settings match.
      if (o_flags & WASI.oflags.CREAT) {
        if (o_flags & WASI.oflags.EXCL) {
          // File cannot yet exist.
          if (exists) {
            return WASI.errno.EEXIST;
          }
        }

        // If file doesn't exist yet, create a stub file.
        if (!exists) {
          doTruncate = true;
        }
      } else {
        // File must exist.
        if (!exists) {
          return WASI.errno.ENOENT;
        }
      }

      // Handle truncation.
      if (doTruncate) {
        await this.fs_.writeFile(path, '');
      }

      const ret = new IndexeddbFsFileHandle(path, this.fs_);
      await ret.init();
      if (fs_flags & WASI.fdflags.APPEND) {
        ret.seek(0, WASI.whence.END);
      }
      return ret;
    }
    return PathHandler.prototype.open.call(this, path, fs_flags, o_flags);
  }

  /** @override */
  async rename(oldPath, newPath) {
    // This is atomic enough because JS is single threaded.  It's fine even
    // between multiple instances since it'll behave like multiple ssh runs.
    //
    // NB: There is a renameFile API, but it expects the new name to be a base
    // name only.  It doesn't support full paths in both source & destination.
    //
    // NB: There is a moveFile API, but it fails if the target exists already.
    // If we unlink+move, there's still a race with multiple ssh runs.
    //
    // So we fake it here with read(old)+write(new)+unlink(old).

    let data;
    try {
      data = await this.fs_.readFile(oldPath);
    } catch (e) {
      return WASI.errno.ENOENT;
    }

    try {
      await this.fs_.writeFile(newPath, data);
    } catch (e) {
      return WASI.errno.EINVAL;
    }

    await this.unlink(oldPath);

    return WASI.errno.ESUCCESS;
  }

  /** @override */
  async stat() {
    let details = null;
    try {
      details = await this.fs_.details(this.path);
    } catch (e) {
      return WASI.errno.ENOENT;
    }

    // This is kind of terrible, but the indexeddb-fs module doesn't have a way
    // to query the size of a file.  It shouldn't be *too* terrible for our use
    // as we don't stat /.ssh files very often, and they're usually on the small
    // side (as in, O(KB)).
    let size = 0n;
    if (details.type === 'file') {
      const str = await this.fs_.readFile(this.path);
      if (typeof str === 'string') {
        const te = new TextEncoder();
        const data = te.encode(str);
        size = BigInt(data.length);
      } else {
        size = str.byteLength;
      }
    }
    return /** @type {!WASI_t.filestat} */ ({
      filetype:
        details.type === 'directory' ?
          WASI.filetype.DIRECTORY :
          WASI.filetype.REGULAR_FILE,
      size: size,
      atim: BigInt(details.createdAt),
      mtim: BigInt(details.createdAt),
      ctim: BigInt(details.createdAt),
    });
  }

  /** @override */
  async unlink(path) {
    try {
      await this.fs_.removeFile(path);
      return WASI.errno.ESUCCESS;
    } catch (e) {
      return WASI.errno.ENOENT;
    }
  }
}

/**
 * A directory handle backed by indexeddb-fs.
 */
export class IndexeddbFsDirectoryHandle extends DirectoryHandle {
}

/**
 * An open file handle backed by indexeddb-fs.
 */
export class IndexeddbFsFileHandle extends FileHandle {
  constructor(path, fileSystem) {
    super(path, WASI.filetype.REGULAR_FILE);
    this.fs_ = fileSystem;
  }

  /** @override */
  async init() {
    const data = await this.fs_.readFile(this.path);
    if (typeof data === 'string') {
      const te = new TextEncoder();
      this.data = te.encode(data);
    } else {
      this.data = new Uint8Array(data);
    }
  }

  /** @override */
  async close() {
    let str = this.data;
    if (typeof str !== 'string') {
      const td = new TextDecoder();
      str = td.decode(str);
    }
    await this.fs_.writeFile(this.path, str);
  }
}

export class CwdHandler extends DirectoryHandler {
  constructor(target) {
    // NB: This has to be '.' so the WASI layers can find the cwd node.
    // TODO(vapier): Check this is true and document properly.
    super('.');
    // TODO(vapier): Figure out relationship between path & target.
    this.target = target;
  }

  /**
   * @suppress {checkTypes}
   * @override
   */
  async open(path, fs_flags, o_flags) {
    const ret = await DirectoryHandler.prototype.open.call(
        this, path, fs_flags, o_flags);
    ret.target = this.target;
    return ret;
  }
}

export class DevNullHandler extends PathHandler {
  constructor(path = '/dev/null', filetype = WASI.filetype.CHARACTER_DEVICE,
              handleCls = DevNullHandle) {
    super(path, filetype, handleCls);
  }
}

export class DevNullHandle extends PathHandle {
  /** @override */
  async write(buf) {
    return {nwritten: buf.length};
  }

  /** @override */
  async pwrite(buf, offset) {
    return {nwritten: buf.length};
  }

  /** @override */
  async read(length) {
    return {nread: 0};
  }

  /** @override */
  async pread(length, offset) {
    return {nread: 0};
  }

  /** @override */
  seek(offset, whence) {
    return {newoffset: 0n};
  }
}

class PathMap extends Map {
}

/**
 */
class FdMap extends Map {
  constructor() {
    super();
    // This is what WASI sets FD_SETSIZE to, and OpenSSH relies on select(), so
    // keep fds within this range for now.  It means we can never have more than
    // this many open fds at once, but that *shouldn't* be a problem.
    this.max_ = 1024;
    this.next_ = 0;
  }

  open(handle) {
    const fd = this.next();
    if (fd < 0) {
      return fd;
    }
    this.set(fd, handle);
    return fd;
  }

  dup(oldfd) {
    const handle = this.get(oldfd);
    if (handle === undefined) {
      return false;
    }

    // NB: Not quite right.
    return this.open(handle);
  }

  dup2(oldfd, newfd) {
    const handle = this.get(oldfd);
    if (handle === undefined) {
      return false;
    }

    if (oldfd === newfd) {
      return true;
    }

    const oldhandle = this.get(newfd);
    if (oldhandle !== undefined) {
      oldhandle.close();
    }

    // NB: Not quite right.
    this.set(newfd, handle);
    return true;
  }

  // Suppress linter for bug
  // https://github.com/gajus/eslint-plugin-jsdoc/issues/932
  //
  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * Find a free file descriptor in the table.
   *
   * @return {number} The next free file descriptor.
   */
  next() {
    // Whether we hit the max fd and looped around to the start.  We do this
    // once, but if we loop a second time, give up.  We don't want to get stuck
    // here eating cpu forever if the file descriptor table actually fills up.
    let looped = false;
    while (1) {
      const fd = this.next_++;
      if (!this.has(fd)) {
        // We finally found a free entry.  Make sure it's within range.
        if (fd < this.max_) {
          return fd;
        } else {
          // We hit the max, so try to loop (once).
          if (looped) {
            return -1;
          } else {
            looped = true;
            this.next_ = 0;
          }
        }
      }
    }
  }
}

/**
 * The main virtual filesystem instance.
 *
 * This glues all the worlds together.
 */
export class VFS {
  constructor({trace = false}) {
    this.fds_ = new FdMap();
    this.paths_ = new PathMap();
    this.trace_ = trace;
  }

  debug(...args) {
    console.debug('VFS', ...args);
  }

  initStdio(handle) {
    const fd = this.openHandle(handle);
    this.fds_.dup2(fd, 0);
    this.fds_.dup2(fd, 1);
    this.fds_.dup2(fd, 2);
    if (fd > 2) {
      this.close(fd);
    }
  }

  addHandler(handler) {
    this.paths_.set(handler.path, handler);
  }

  getFileHandle(fd) {
    // This log is a little too chatty to enable by default.
    // this.debug(`getFileHandle(${fd})`);
    return this.fds_.get(fd);
  }

  openHandle(handle) {
    this.debug(`openHandle(${handle})`);
    return this.fds_.open(handle);
  }

  /**
   * Resolve a path relative to a file descriptor.
   *
   * @param {!WASI_t.fd} fd The directory fd to resolve path under.
   * @param {string} path The path to open relative to the dirfd.
   * @return {!WASI_t.errno|string} The resolved path, or errno if failed.
   */
  resolvePath_(fd, path) {
    // If path is already absolute, then we never use the dirfd.
    if (path.startsWith('/')) {
      return path;
    }

    // Find the handle for this fd.
    let fh = this.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    // Make sure the handle is actually a directory.
    if (fh.filetype !== WASI.filetype.DIRECTORY) {
      return WASI.errno.ENOTDIR;
    }

    // If the base dir is cwd, resolve that too.
    if (fh.path === '.') {
      fh = this.paths_.get(fh.target);
    }

    // Normalize leading & trailing slashes.
    let dirpath = fh.path.replace(/^\/+/, '').replace(/\/+$/, '');
    if (dirpath) {
      // Don't add trailing slash if dirpath is "" (i.e. it's the root dir).
      dirpath += '/';
    }

    return `/${dirpath}${path}`;
  }

  /**
   * Find the path handler via an absolute path.
   *
   * If the path itself doesn't have one, we'll try to locate a parent based
   * on parent directories.
   *
   * @param {string} path Resolved path.
   * @return {!WASI_t.errno|!PathHandler}
   */
  findHandler_(path) {
    let search_path = path;
    do {
      if (this.paths_.has(search_path)) {
        return this.paths_.get(search_path);
      }
      search_path = search_path.substring(0, search_path.lastIndexOf('/'));
    } while (search_path !== '');

    return this.paths_.get('/') || WASI.errno.ENOENT;
  }

  /**
   * @param {string} path
   * @return {!Promise<!WASI_t.errno|!WASI_t.filestat>}
   */
  async stat(path) {
    this.debug(`stat(${path})`);

    const handler = this.findHandler_(path);
    if (typeof handler === 'number') {
      return handler;
    }
    return handler.stat();
  }

  /**
   * @param {!WASI_t.fd} fd
   * @param {string} path
   * @return {!Promise<!WASI_t.errno|!WASI_t.filestat>}
   */
  async statat(fd, path) {
    this.debug(`statat(${fd}, ${path})`);

    const resolvedPath = this.resolvePath_(fd, path);
    if (typeof resolvedPath === 'number') {
      return resolvedPath;
    }
    return this.stat(resolvedPath);
  }

  /**
   * @param {string} path
   * @param {!WASI_t.fdflags} fs_flags
   * @param {!WASI_t.oflags} o_flags
   * @return {!Promise<!WASI_t.errno|{fd: number}>}
   */
  async open(path, fs_flags, o_flags) {
    this.debug(`open(${path}, ${fs_flags}, ${o_flags})`);

    const handler = this.findHandler_(path);
    if (typeof handler === 'number') {
      return handler;
    }

    const handle = await handler.open(path, fs_flags, o_flags);
    if (typeof handle === 'number') {
      return handle;
    }
    const fd = this.openHandle(handle);
    if (fd < 0) {
      await handle.close();
      return WASI.errno.EMFILE;
    } else {
      return {fd};
    }
  }

  /**
   * @param {!WASI_t.fd} dfd
   * @param {!WASI_t.lookupflags} dirflags
   * @param {string} path
   * @param {!WASI_t.fdflags} fs_flags
   * @param {!WASI_t.oflags} o_flags
   * @return {!Promise<!WASI_t.errno|{fd: number}>}
   */
  async openat(dfd, dirflags, path, fs_flags, o_flags) {
    this.debug(`openat(${dfd}, ${dirflags}, ${path}, ${fs_flags}, ${o_flags})`);

    // NB: dirflags currently only involves symlinks which we don't support.
    const resolvedPath = this.resolvePath_(dfd, path);
    if (typeof resolvedPath === 'number') {
      return resolvedPath;
    }
    return this.open(resolvedPath, fs_flags, o_flags);
  }

  close(fd) {
    this.debug(`close(${fd})`);

    const fh = this.getFileHandle(fd);
    if (fh !== undefined) {
      this.fds_.delete(fd);
      fh.close();
      return WASI.errno.ESUCCESS;
    } else {
      return WASI.errno.EBADF;
    }
  }

  dup(oldfd) {
    this.debug(`dup(${oldfd})`);

    const fd = this.fds_.dup(oldfd);
    if (fd === false) {
      return WASI.errno.EBADF;
    }
    return {fd};
  }

  dup2(oldfd, newfd) {
    this.debug(`dup2(${oldfd}, ${newfd})`);

    return this.fds_.dup2(oldfd, newfd) ?
        WASI.errno.ESUCCESS : WASI.errno.EBADF;
  }

  /**
   * @param {!WASI_t.fd} fd
   * @param {string} path
   * @return {!Promise<!WASI_t.errno|{fd: number}>}
   */
  async mkdirat(fd, path) {
    this.debug(`mkdirat(${fd}, ${path})`);

    const resolvedPath = this.resolvePath_(fd, path);
    if (typeof resolvedPath === 'number') {
      return resolvedPath;
    }
    return this.mkdir(resolvedPath);
  }

  /**
   * @param {string} path
   * @return {!WASI_t.errno|{fd: number}}
   */
  mkdir(path) {
    this.debug(`mkdir(${path})`);

    // TODO(vapier): Push this down a layer.
    switch (path) {
      case '/.ssh': return WASI.errno.ESUCCESS;
    }

    return WASI.errno.ENOENT;
  }

  /**
   * @param {!WASI_t.fd} old_fd
   * @param {!WASI_t.lookupflags} old_flags
   * @param {string} old_path
   * @param {!WASI_t.fd} new_fd
   * @param {string} new_path
   * @return {!Promise<!WASI_t.errno>}
   */
  async linkat(old_fd, old_flags, old_path, new_fd, new_path) {
    this.debug(`linkat(${old_fd}, ${old_flags}, ${old_path}, ${new_fd}, ` +
               `${new_path})`);

    const oldResolvedPath = this.resolvePath_(old_fd, old_path);
    if (typeof oldResolvedPath === 'number') {
      return oldResolvedPath;
    }
    const newResolvedPath = this.resolvePath_(new_fd, new_path);
    if (typeof newResolvedPath === 'number') {
      return newResolvedPath;
    }

    return this.link(oldResolvedPath, newResolvedPath);
  }

  /**
   * @param {string} old_path
   * @param {string} new_path
   * @return {!Promise<!WASI_t.errno>}
   */
  async link(old_path, new_path) {
    this.debug(`link(${old_path}, ${new_path})`);

    const oldHandler = this.findHandler_(old_path);
    if (typeof oldHandler === 'number') {
      return oldHandler;
    }
    const newHandler = this.findHandler_(new_path);
    if (typeof newHandler === 'number') {
      return newHandler;
    }

    if (oldHandler === newHandler) {
      return oldHandler.link(old_path, new_path);
    } else {
      return WASI.errno.EXDEV;
    }
  }

  /**
   * @param {!WASI_t.fd} old_fd
   * @param {string} old_path
   * @param {!WASI_t.fd} new_fd
   * @param {string} new_path
   * @return {!Promise<!WASI_t.errno>}
   */
  async renameat(old_fd, old_path, new_fd, new_path) {
    this.debug(`renameat(${old_fd}, ${old_path}, ${new_fd}, ${new_path})`);

    const oldResolvedPath = this.resolvePath_(old_fd, old_path);
    if (typeof oldResolvedPath === 'number') {
      return oldResolvedPath;
    }
    const newResolvedPath = this.resolvePath_(new_fd, new_path);
    if (typeof newResolvedPath === 'number') {
      return newResolvedPath;
    }

    return this.rename(oldResolvedPath, newResolvedPath);
  }

  /**
   * @param {string} old_path
   * @param {string} new_path
   * @return {!Promise<!WASI_t.errno>}
   */
  async rename(old_path, new_path) {
    this.debug(`rename(${old_path}, ${new_path})`);

    const oldHandler = this.findHandler_(old_path);
    if (typeof oldHandler === 'number') {
      return oldHandler;
    }
    const newHandler = this.findHandler_(new_path);
    if (typeof newHandler === 'number') {
      return newHandler;
    }

    if (oldHandler === newHandler) {
      return oldHandler.rename(old_path, new_path);
    } else {
      return WASI.errno.EXDEV;
    }
  }

  /**
   * @param {!WASI_t.fd} fd
   * @param {string} path
   * @return {!Promise<!WASI_t.errno|{fd: number}>}
   */
  async unlinkat(fd, path) {
    this.debug(`unlinkat(${fd}, ${path})`);
    const resolvedPath = this.resolvePath_(fd, path);
    if (typeof resolvedPath === 'number') {
      return resolvedPath;
    }
    return this.unlink(resolvedPath);
  }

  /**
   * @param {string} path
   * @return {!Promise<!WASI_t.errno|{fd: number}>}
   */
  async unlink(path) {
    this.debug(`unlink(${path})`);
    const handler = this.findHandler_(path);
    if (typeof handler === 'number') {
      return handler;
    }
    return handler.unlink(path);
  }
}
