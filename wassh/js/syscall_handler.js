// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview
 * @suppress {moduleLoad}
 * @suppress {checkTypes} module$__$wasi_js_bindings$js naming confusion.
 */

import {SyscallHandler, WASI} from '../../wasi-js-bindings/index.js';
import * as Constants from './constants.js';
import * as Sockets from './sockets.js';
import * as VFS from './vfs.js';

/**
 * How many nanoseconds in one millisecond.
 */
const kNanosecToMillisec = 1000000;

class Tty extends VFS.FileHandle {
  constructor(term, handler) {
    super('/dev/tty', WASI.filetype.CHARACTER_DEVICE);
    this.term = term;
    this.handler = handler;
    // TODO(vapier): Make this into a stream.
    this.data = new Uint8Array();
    this.term.io.onVTKeystroke = this.term.io.sendString =
        this.onData_.bind(this);
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
    this.term.io.writeUTF8(data);
    return {nwritten: data.length};
  }

  /** @override */
  async read(length) {
    const buf = Array.from(this.data.slice(0, length));
    this.data = this.data.subarray(length);
    return {buf};
  }

  /** @override */
  onData_(str) {
    const te = new TextEncoder();
    const data = te.encode(str);
    const u8 = new Uint8Array(data);
    const newData = new Uint8Array(this.data.length + u8.length);
    newData.set(this.data);
    newData.set(u8, this.data.length);
    this.data = newData;
    if (this.handler.notify_) {
      this.handler.notify_();
    }
  }
}

/**
 * Wassh implementation of proxied syscalls.
 *
 * These may be asynchronous.
 */
export class RemoteReceiverWasiPreview1 extends SyscallHandler.Base {
  constructor({term, tcpSocketsOpen, unixSocketsOpen, secureInput,
               fileSystem} = {}) {
    super();
    this.term_ = term;
    this.tcpSocketsOpen_ = tcpSocketsOpen;
    this.unixSocketsOpen_ = unixSocketsOpen;
    this.secureInput_ = secureInput;
    this.notify_ = null;
    this.fileSystem_ = fileSystem;
    this.vfs = new VFS.VFS({stdio: false});
    this.socketUdpRecv_ = null;
    this.fakeAddrMap_ = new Map();
    this.firstConnection_ = true;
  }

  async init() {
    const tty = new Tty(this.term_, this);
    this.vfs.initStdio(tty);

    const root = new VFS.DirectoryHandler('/');
    this.vfs.addHandler(root);
    await this.vfs.open('/');

    const sshdir = new VFS.IndexeddbFsDirectoryHandler(
        '/.ssh', this.fileSystem_);
    await this.fileSystem_.createDirectory('/.ssh');
    this.vfs.addHandler(sshdir);

    const cwd = new VFS.CwdHandler('/');
    this.vfs.addHandler(cwd);
    await this.vfs.open('.');

    this.vfs.addHandler(new VFS.DevNullHandler());

    this.term_.io.onTerminalResize = (width, height) => {
      // https://github.com/WebAssembly/wasi-libc/issues/272
      this.process_.send_signal(28 /* musl SIGWINCH */);
    };
  }

  /** @override */
  handle_fd_close(fd) {
    return this.vfs.close(fd);
  }

  /** @override */
  async handle_path_filestat_get(fd, lookupflags, path) {
    const stat = await this.vfs.statat(fd, path);
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
  async handle_fd_filestat_get(fd) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    const stat = await this.vfs.stat(fh.path);
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
  async handle_fd_fdstat_get(fd) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    const stat = await fh.stat();
    return /** @type {!WASI_t.fdstat} */ ({
      fs_filetype: WASI.filetype.UNKNOWN,
      fs_flags: 0,
      fs_rights_base: 0xffffffffffffffffn,
      fs_rights_inheriting: 0xffffffffffffffffn,
      ...stat,
    });
  }

  /** @override */
  handle_fd_fdstat_set_flags(fd, fdflags) {
    const fh = this.vfs.getFileHandle(fd);
    if (fh === undefined) {
      return WASI.errno.EBADF;
    }

    // Ignore sync flags as we always sync storage.
    fdflags &= ~(WASI.fdflags.DSYNC | WASI.fdflags.RSYNC | WASI.fdflags.SYNC);

    // TODO(vapier): Support O_NONBLOCK.
    fdflags &= ~WASI.fdflags.NONBLOCK;

    return fdflags ? WASI.errno.EINVAL : WASI.errno.ESUCCESS;
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
  handle_path_create_directory(fd, path) {
    return this.vfs.mkdirat(fd, path);
  }

  /** @override */
  handle_path_link(old_fd, old_flags, old_path, new_fd, new_path) {
    return this.vfs.linkat(old_fd, old_flags, old_path, new_fd, new_path);
  }

  /** @override */
  handle_path_open(dirfd, dirflags, path, o_flags, fs_rights_base,
                   fs_rights_inheriting, fs_flags) {
    return this.vfs.openat(dirfd, dirflags, path, fs_flags, o_flags);
  }

  /** @override */
  handle_path_rename(fd, old_path, new_fd, new_path) {
    return this.vfs.renameat(fd, old_path, new_fd, new_path);
  }

  /** @override */
  async handle_path_unlink_file(fd, path) {
    return this.vfs.unlinkat(fd, path);
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
      const delay = timeout - BigInt(Date.now());
      if (delay > 0) {
        await sleep(delay);
      }

      // If signals came in, return them too.
      let signals;
      if (this.process_.signal_queue.length) {
        signals = Array.from(this.process_.signal_queue);
        this.process_.signal_queue.length = 0;
      }

      return {events: [timeoutEvent], signals};
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
          } else if (handle.filetype === WASI.filetype.SOCKET_STREAM ||
                     handle.filetype === WASI.filetype.SOCKET_DGRAM ||
                     handle.filetype === WASI.filetype.CHARACTER_DEVICE) {
            // If it's a socket, see if any data is available.
            if (subscription.tag === WASI.eventtype.FD_READ) {
              if (handle.data.length || handle?.clients_?.length) {
                events.push(eventBase);
              }
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
          const delay = timeout - BigInt(Date.now());
          if (delay > 0) {
            await sleep(delay);
          }
        }
      } else {
        // If a signal came in, don't keep waiting for events.
        if (this.process_.signal_queue.length) {
          break;
        }

        // If we still have work to do, wait for a wakeup.
        if (events.length === 0) {
          await sleep(30000);
        }
      }
    }

    // If signals came in, return them too.
    let signals;
    if (this.process_.signal_queue.length) {
      signals = Array.from(this.process_.signal_queue);
      this.process_.signal_queue.length = 0;
    }

    return {events, signals};
  }

  /**
   * @param {number} socket
   * @return {!WASI_t.errno}
   */
  async handle_sock_accept(socket) {
    const handle = this.vfs.getFileHandle(socket);
    if (handle === undefined) {
      return WASI.errno.EBADF;
    }
    if (!(handle instanceof Sockets.Socket)) {
      return WASI.errno.ENOTSOCK;
    }

    const newHandle = await handle.accept();
    if (typeof newHandle === 'number') {
      return newHandle;
    }
    newHandle.setReceiveListener(() => {
      if (this.notify_) {
        this.notify_();
      }
    });
    // NB: The accept code already initialized the socket.

    const newSocket = this.vfs.openHandle(newHandle);
    if (newSocket < 0) {
      await newHandle.close();
      return WASI.errno.EMFILE;
    } else {
      return {socket: newSocket};
    }
  }

  /**
   * @param {number} socket
   * @param {string} address
   * @param {number} port
   * @return {!WASI_t.errno}
   */
  async handle_sock_bind(socket, address, port) {
    const handle = this.vfs.getFileHandle(socket);
    if (handle === undefined) {
      return WASI.errno.EBADF;
    }
    if (!(handle instanceof Sockets.Socket)) {
      return WASI.errno.ENOTSOCK;
    }

    const newHandle = await handle.bind(address, port);
    if (typeof newHandle === 'number') {
      return newHandle;
    }
    if (newHandle !== handle) {
      // In case the handle changes, hot swap it.
      newHandle.receiveListener_ = handle.receiveListener_;
      handle.close();
      this.vfs.fds_.set(socket, newHandle);
    }

    return WASI.errno.ESUCCESS;
  }

  /**
   * @param {number} socket
   * @param {number} how
   * @return {!WASI_t.errno}
   */
  async handle_sock_shutdown(socket, how) {
    const handle = this.vfs.getFileHandle(socket);
    if (handle === undefined) {
      return WASI.errno.EBADF;
    }
    if (!(handle instanceof Sockets.Socket)) {
      return WASI.errno.ENOTSOCK;
    }

    if (how != 0x2 /* SHUT_RDWR */) {
      // TODO(vapier): Should we handle shutting down channels independently?
      console.warn(`shutdown(${handle}, ${how}): Assuming SHUT_RDWR`);
    }

    await handle.close();
    return WASI.errno.ESUCCESS;
  }

  /**
   * @param {number} socket
   * @param {number} backlog
   * @return {!WASI_t.errno}
   */
  async handle_sock_listen(socket, backlog) {
    const handle = this.vfs.getFileHandle(socket);
    if (handle === undefined) {
      return WASI.errno.EBADF;
    }
    if (!(handle instanceof Sockets.Socket)) {
      return WASI.errno.ENOTSOCK;
    }

    return handle.listen(backlog);
  }

  /**
   * @param {number} idx
   * @param {string} name
   * @return {!WASI_t.errno}
   */
  handle_sock_register_fake_addr(idx, name) {
    this.fakeAddrMap_.set(idx, name);
    return WASI.errno.ESUCCESS;
  }

  /**
   * @param {number} domain
   * @param {number} type
   * @param {number} protocol
   * @return {!WASI_t.errno|{socket: !WASI_t.fd}}
   */
  async handle_sock_create(domain, type, protocol) {
    let handle;
    switch (domain) {
      case Constants.AF_INET:
      case Constants.AF_INET6:
        switch (type) {
          case WASI.filetype.SOCKET_STREAM:
            if (this.tcpSocketsOpen_ && this.firstConnection_) {
              handle = new Sockets.RelaySocket(
                  domain, type, protocol, this.tcpSocketsOpen_);
              this.firstConnection_ = false;
            } else if (Sockets.ChromeTcpSocket.isSupported()) {
              handle = new Sockets.ChromeTcpSocket(domain, type, protocol);
            } else if (Sockets.WebTcpSocket.isSupported()) {
              handle = new Sockets.WebTcpSocket(domain, type, protocol);
            } else {
              return WASI.errno.EPROTONOSUPPORT;
            }
            break;
          case WASI.filetype.SOCKET_DGRAM:
            if (Sockets.ChromeUdpSocket.isSupported()) {
              handle = new Sockets.ChromeUdpSocket(domain, type, protocol);
            } else {
              return WASI.errno.EPROTONOSUPPORT;
            }
            break;
          default:
            return WASI.errno.EPROTONOSUPPORT;
        }
        break;

      case Constants.AF_UNIX:
        switch (type) {
          case WASI.filetype.SOCKET_STREAM:
          case WASI.filetype.SOCKET_DGRAM:
            handle = Sockets.UnixSocket(
                domain, type, protocol, this.unixSocketsOpen_);
            break;
          default:
            return WASI.errno.EPROTONOSUPPORT;
        }

      default:
        return WASI.errno.EAFNOSUPPORT;
    }

    handle.setReceiveListener(() => {
      if (this.notify_) {
        this.notify_();
      }
    });

    if (await handle.init() === false) {
      return WASI.errno.ENOSYS;
    }

    const socket = this.vfs.openHandle(handle);
    if (socket < 0) {
      await handle.close();
      return WASI.errno.EMFILE;
    } else {
      return {socket};
    }
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

    // The getaddrinfo function used -1 to register a delayed hostname lookup.
    if (handle.protocol === -1) {
      address = this.fakeAddrMap_.get(address);
      if (address === undefined) {
        return WASI.errno.EFAULT;
      }
    }

    // TODO(crbug.com/1303495): Delete this hack.  The old NaCl plugin uses a
    // hardcoded IP to connect to the agent instead of using UNIX sockets.  Need
    // to cleanup the OpenSSH patches first.
    if (address === '127.1.2.3') {
      const unixHandle = new Sockets.UnixSocket(
          handle.domain, handle.filetype, handle.protocol,
          this.unixSocketsOpen_);
      unixHandle.receiveListener_ = handle.receiveListener_;
      handle.close();
      this.vfs.fds_.set(socket, unixHandle);
      return unixHandle.connect(address, port);
    }

    return handle.connect(address, port);
  }

  /**
   * @param {!WASI_t.fd} socket
   * @param {!WASI_t.size} remote
   * @return {!WASI_t.errno|{
   *    family: number,
   *    address: !Array<number>,
   *    port: number,
   * }}
   */
  async handle_sock_get_name(socket, remote) {
    const handle = this.vfs.getFileHandle(socket);
    if (handle === undefined) {
      return WASI.errno.EBADF;
    }
    if (!(handle instanceof Sockets.Socket)) {
      return WASI.errno.ENOTSOCK;
    }

    const info = await handle.getSocketInfo();
    if (!info.connected) {
      return WASI.errno.ENOTCONN;
    }

    const strAddress = remote ? info.peerAddress : info.localAddress;
    let address;
    let family;
    if (strAddress === undefined) {
      // TODO(vapier): Probably need to extend Chrome APIs to set these all the
      // time.  A socket opened via tcpServer seems to be missing local info.
      family = Constants.AF_INET;
      address = [0, 0, 0, 0];
    } else {
      address = Sockets.strAddrToArray(strAddress);
      if (address.length === 4) {
        family = Constants.AF_INET;
      } else {
        family = Constants.AF_INET6;
      }
    }

    const port = (remote ? info.peerPort : info.localPort) ?? 0;
    return {family, address, port};
  }

  /**
   * @param {!WASI_t.fd} socket
   * @param {number} level
   * @param {number} name
   * @return {!WASI_t.errno|{option: number}}
   */
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

  /**
   * @param {!WASI_t.fd} socket
   * @param {number} level
   * @param {number} name
   * @param {number} value
   * @return {!WASI_t.errno}
   */
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

  /**
   * @param {!WASI_t.fd} socket
   * @param {number} length
   * @param {!WASI_t.s32} flags
   * @return {!WASI_t.errno|{
   *   nwritten: number,
   *   domain: number,
   *   address: string,
   *   port: number,
   * }}
   */
  async handle_sock_recvfrom(socket, length, flags) {
    const handle = this.vfs.getFileHandle(socket);
    if (handle === undefined) {
      return WASI.errno.EBADF;
    }
    if (!(handle instanceof Sockets.Socket)) {
      return WASI.errno.ENOTSOCK;
    }

    const ret = await handle.read(length, !(flags & Constants.MSG_DONTWAIT));
    if (typeof ret === 'number') {
      return ret;
    }

    ret.domain = handle.domain;
    ret.address = Sockets.strAddrToArray(handle.address);
    ret.port = handle.port;

    return ret;
  }

  /**
   * @param {!WASI_t.fd} socket
   * @param {!Uint8Array} buf
   * @param {!WASI_t.s32} flags
   * @param {!WASI_t.s32} domain
   * @param {string} address
   * @param {!WASI_t.u16} port
   * @return {!WASI_t.errno}
   */
  handle_sock_sendto(socket, buf, flags, domain, address, port) {
    const handle = this.vfs.getFileHandle(socket);
    if (handle === undefined) {
      return WASI.errno.EBADF;
    }
    if (!(handle instanceof Sockets.Socket)) {
      return WASI.errno.ENOTSOCK;
    }

    return handle.sendto(buf, address, port);
  }

  /**
   * Get the terminal window size.
   *
   * @param {!WASI_t.fd} fd Open file descriptor bound to the tty.
   * @return {{row: number, col: number, xpixel: number, ypixel: number}} The
   *     terminal window metrics.
   */
  async handle_tty_get_window_size(fd) {
    // TODO(vapier): Should this utilize fd?  We only ever have one tty ...
    const size = this.term_.screenSize;
    return {
      row: size.height,
      col: size.width,
      // TODO(vapier): Add info to hterm and return it here.  Needed for SIXEL,
      // but not much else atm.
      xpixel: 0,
      ypixel: 0,
    };
  }

  /**
   * @param {!Uint8Array} prompt The string to display to the user.
   * @param {number} max_len The max number of bytes to let the user enter.
   * @param {boolean} echo Whether to display the user input by default.
   * @return {{pass: string}} The user input.
   */
  async handle_readpassphrase(prompt, max_len, echo) {
    return {
      pass: await this.secureInput_(prompt, max_len, echo),
    };
  }
}
