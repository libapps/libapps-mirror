// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview
 * @suppress {moduleLoad}
 * @suppress {checkTypes} module$__$wasi_js_bindings$js naming confusion.
 */

import {SyscallHandler, WASI} from '../../wasi-js-bindings/index.js';
import * as Sockets from './sockets.js';
import * as VFS from './vfs.js';

/**
 * How many nanoseconds in one millisecond.
 */
const kNanosecToMillisec = 1000000;

class Tty extends VFS.FileHandle {
  constructor(term) {
    super('/dev/tty', WASI.filetype.CHARACTER_DEVICE);
    this.term = term;
    this.td = new TextDecoder();
  }

  /** @override */
  stat() {
    return {
      fs_filetype: this.filetype,
      fs_rights_base: WASI.rights.FD_READ | WASI.rights.FD_WRITE,
    };
  }

  /** @override */
  write(data) {
    this.term.innerText += this.td.decode(data, {stream: true});
    return {nwritten: data.length};
  }
}

/**
 * Wassh implementation of direct syscalls.
 *
 * These must all be synchronous.
 */
export class DirectWasiPreview1 extends SyscallHandler.DirectWasiPreview1 {
}

/**
 * Wassh implementation of proxied syscalls.
 *
 * These may be asynchronous.
 */
export class RemoteReceiverWasiPreview1 extends SyscallHandler.Base {
  constructor(...args) {
    super(...args);
    this.notify_ = null;
    this.vfs = new VFS.VFS({stdio: false});
    this.socketTcpRecv_ = null;
    this.socketUdpRecv_ = null;
    this.socketMap_ = new Map();
  }

  async init() {
    const tty = new Tty(document.getElementById('terminal'));
    this.vfs.initStdio(tty);

    const root = new VFS.DirectoryHandler('/');
    this.vfs.addHandler(root);
    await this.vfs.open('/');

    const sshdir = new VFS.OriginPrivateDirectoryHandler('/.ssh');
    this.vfs.addHandler(sshdir);

    const cwd = new VFS.CwdHandler('/.ssh');
    this.vfs.addHandler(cwd);
    await this.vfs.open('.');

    this.vfs.addHandler(new VFS.DevNullHandler());
  }

  /** @override */
  handle_fd_close(fd) {
    return this.vfs.close(fd);
  }

  /** @override */
  handle_path_filestat_get(path) {
    const stat = this.vfs.stat(path);
    if (typeof stat === 'number') {
      return stat;
    }

    return /** @type {!WASI_t.filestat} */ ({
      dev: 0n,
      ino: 0n,
      filetype: WASI.filetype.UNKNOWN,
      nlink: 0n,
      size: 0n,
      atim: 0n,
      mtim: 0n,
      ctim: 0n,
      ...stat,
    });
  }

  /** @override */
  handle_fd_filestat_get(fd) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    const stat = this.vfs.stat(fh.path);
    if (typeof stat === 'number') {
      return stat;
    }

    return /** @type {!WASI_t.filestat} */ ({
      dev: 0n,
      ino: 0n,
      filetype: WASI.filetype.UNKNOWN,
      nlink: 0n,
      size: 0n,
      atim: 0n,
      mtim: 0n,
      ctim: 0n,
      ...stat,
    });
  }

  /** @override */
  handle_fd_fdstat_get(fd) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    const stat = fh.stat();
    return /** @type {!WASI_t.fdstat} */ ({
      fs_filetype: WASI.filetype.UNKNOWN,
      fs_flags: 0,
      fs_rights_base: 0xffffffffffffffffn,
      fs_rights_inheriting: 0xffffffffffffffffn,
      ...stat,
    });
  }

  /** @override */
  async handle_fd_pread(fd, length, offset) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    return fh.pread(length, offset);
  }

  /** @override */
  handle_fd_prestat_dir_name(fd) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    // This func only operates on dirs.
    if (fh.filetype !== WASI.filetype.DIRECTORY) {
      return WASI.errno.ENOTDIR;
    }

    return {path: fh.path};
  }

  /** @override */
  handle_fd_prestat_get(fd) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    // This func only operates on dirs.
    if (fh.filetype !== WASI.filetype.DIRECTORY) {
      return WASI.errno.ENOTDIR;
    }

    return {path: fh.path};
  }

  /** @override */
  async handle_fd_pwrite(fd, offset, buf) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    return fh.pwrite(offset, buf);
  }

  /** @override */
  handle_fd_dup(oldfd) {
    return this.vfs.dup(oldfd);
  }

  /** @override */
  handle_fd_dup2(oldfd, newfd) {
    return this.vfs.dup(oldfd, newfd);
  }

  /** @override */
  handle_fd_renumber(fd, to) {
    return this.vfs.dup2(fd, to);
  }

  /** @override */
  async handle_fd_read(fd, length) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    return fh.read(length);
  }

  /** @override */
  handle_fd_seek(fd, offset, whence) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    return fh.seek(offset, whence);
  }

  /** @override */
  handle_fd_tell(fd) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    return fh.tell();
  }

  /** @override */
  async handle_fd_write(fd, buf) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    return fh.write(buf);
  }

  /** @override */
  handle_path_open(dirfd, dirflags, path, o_flags, fs_rights_base,
                   fs_rights_inheriting, fs_flags) {
    return this.vfs.openat(dirfd, dirflags, path, o_flags);
  }

  /** @override */
  async handle_poll_oneoff(subscriptions) {
    const now = BigInt(Date.now());

    const sleep = async (msec) => {
      return new Promise((resolve) => {
        this.debug(`poll: sleeping for ${msec} milliseconds`);
        const resolveIt = () => {
          resolve();
          this.notify_ = null;
        };
        const timeout = setTimeout(resolveIt, Number(msec));
        this.notify_ = () => {
          this.debug('poll: data has arrived!');
          clearTimeout(timeout);
          resolveIt();
        };
      });
    };

    // Find the earliest clock timeout.
    let timeout;
    let userdata;
    subscriptions.forEach((subscription) => {
      if (subscription.tag === WASI.eventtype.CLOCK) {
        // The standard C lib doesn't use other clocks, so this is future-proof.
        if (subscription.clock.id !== WASI.clock.REALTIME) {
          return WASI.errno.ENOTSUP;
        }

        let subTimeout;
        // The timeout is in nanoseconds.  We can do milliseconds at best.
        subTimeout = subscription.clock.timeout / BigInt(kNanosecToMillisec);
        if ((subscription.clock.flags & 1) === 0) {
          // The timeout is relative.
          subTimeout += now;
        }

        if (!timeout || subTimeout < timeout) {
          userdata = subscription.userdata;
          timeout = subTimeout;
        }
      }
    });

    // If there's only a timeout, wait for it.
    const timeoutEvent = {
      userdata: userdata,
      error: WASI.errno.ESUCCESS,
      type: WASI.eventtype.CLOCK,
      fd_readwrite: {
        flags: 0,
        nbytes: 0n,
      },
    };
    if (subscriptions.length === 1 && timeout !== undefined) {
      const delay = timeout - Date.now();
      if (delay > 0) {
        await sleep(delay);
      }
      return {events: [timeoutEvent]};
    }

    // Poll for a while.
    const events = [];
    while (events.length === 0) {
      for (let i = 0; i < subscriptions.length; ++i) {
        const subscription = subscriptions[i];
        const eventBase = {
          userdata: subscription.userdata,
          error: WASI.errno.ESUCCESS,
          type: subscription.tag,
          fd_readwrite: {
            flags: 0,
            nbytes: 0n,
          },
        };

        if (subscription.tag === WASI.eventtype.FD_READ ||
            subscription.tag === WASI.eventtype.FD_WRITE) {
          const fd = subscription.tag === WASI.eventtype.FD_READ ?
              subscription.fd_read.file_descriptor :
              subscription.fd_write.file_descriptor;
          const handle = this.vfs.getFileHandle(fd);
          if (handle === undefined) {
            // If the fd doesn't exist, bail.
            events.push({...eventBase, error: WASI.errno.EBADF});
          } else if (handle.filetype === WASI.filetype.REGULAR_FILE) {
            // If it's a regular file, return right away.
            events.push(eventBase);
          } else if (handle instanceof Sockets.Socket) {
            // If it's a socket, see if any data is available.
            if (subscription.tag === WASI.eventtype.FD_READ &&
                handle.data.length) {
              events.push(eventBase);
            } else if (subscription.tag === WASI.eventtype.FD_WRITE) {
              events.push(eventBase);
            }
          } else {
            events.push({...eventBase, error: WASI.errno.ENOTSUP});
          }
        }
      }

      // See if we ran into the timeout.
      if (timeout !== undefined) {
        if (timeout <= Date.now()) {
          events.push(timeoutEvent);
        }

        // If we still have work to do, wait for a wakeup or timeout.
        if (events.length === 0) {
          const delay = timeout - Date.now();
          if (delay > 0) {
            await sleep(delay);
          }
        }
      } else {
        // If we still have work to do, wait for a wakeup.
        if (events.length === 0) {
          await sleep(30000);
        }
      }
    }
    return {events};
  }

  /**
   * @param {number} domain
   * @param {number} type
   * @return {!WASI_t.errno|{socket: !WASI_t.fd}}
   */
  async handle_sock_create(domain, type) {
    const handle = new Sockets.TcpSocket(domain, type);
    if (await handle.init() === false) {
      return WASI.errno.ENOSYS;
    }
    this.socketMap_.set(handle.socketId, handle);
    const socket = this.vfs.openHandle(handle);
    return {socket};
  }

  /**
   * @param {number} socket
   * @param {string} address
   * @param {number} port
   * @return {!WASI_t.errno}
   */
  async handle_sock_connect(socket, address, port) {
    const handle = this.vfs.getFileHandle(socket);
    if (handle === undefined) {
      return WASI.errno.EBADF;
    }
    if (!(handle instanceof Sockets.Socket)) {
      return WASI.errno.ENOTSOCK;
    }

    if (this.socketTcpRecv_ === null) {
      this.socketTcpRecv_ = this.onSocketTcpRecv.bind(this);
      chrome.sockets.tcp.onReceive.addListener(this.socketTcpRecv_);
    }

    /*
    if (this.socketUdpRecv_ === null) {
      this.socketUdpRecv_ = this.onSocketUdpRecv.bind(this);
      chrome.sockets.Udp.onReceive.addListener(this.socketUdpRecv_);
    }
    */

    return handle.connect(address, port);
  }

  async handle_sock_get_opt(socket, level, name) {
    const handle = this.vfs.getFileHandle(socket);
    if (handle === undefined) {
      return WASI.errno.EBADF;
    }
    if (!(handle instanceof Sockets.Socket)) {
      return WASI.errno.ENOTSOCK;
    }

    return handle.getSocketOption(level, name);
  }

  async handle_sock_set_opt(socket, level, name, value) {
    const handle = this.vfs.getFileHandle(socket);
    if (handle === undefined) {
      return WASI.errno.EBADF;
    }
    if (!(handle instanceof Sockets.Socket)) {
      return WASI.errno.ENOTSOCK;
    }

    return handle.setSocketOption(level, name, value);
  }

  onSocketTcpRecv({socketId, data}) {
    const handle = this.socketMap_.get(socketId);
    if (handle === undefined) {
      console.warn(`Data received for unknown socket ${socketId}`);
      return;
    }

    handle.onRecv(data);
    if (this.notify_) {
      this.notify_();
    }
  }

  /**
   * @param {!Uint8Array} prompt The string to display to the user.
   * @param {number} max_len The max number of bytes to let the user enter.
   * @param {boolean} echo Whether to display the user input by default.
   * @return {{pass: string}} The user input.
   */
  async handle_readpassphrase(prompt, max_len, echo) {
    const fh = this.vfs.getFileHandle(1);
    const te = new TextEncoder();
    fh.write(te.encode(prompt));
    // TODO(vapier): Connect this to the terminal's secure input.  See nassh's
    // secureInput_() API for an example.
    return {pass: 'yes'};
  }
}
