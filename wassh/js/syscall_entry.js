// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Handlers for the custom wassh syscalls.
 * @suppress {moduleLoad}
 * @suppress {checkTypes} module$__$wasi_js_bindings$js naming confusion.
 */

import {SyscallEntry, WASI} from '../../wasi-js-bindings/index.js';
import * as Constants from './constants.js';

/**
 * WASSH syscall extensions.
 */
export class WasshExperimental extends SyscallEntry.Base {
  constructor(runtime) {
    super(runtime);
    this.namespace = 'wassh_experimental';
  }

  /**
   * @param {!WASI_t.fd} sock
   * @param {!WASI_t.pointer} newsock_ptr
   * @return {!WASI_t.errno}
   */
  sys_sock_accept(sock, newsock_ptr) {
    const ret = this.handle_sock_accept(sock);
    if (typeof ret === 'number') {
      return ret;
    }

    const dv = this.getView_(newsock_ptr, 4);
    dv.setFd(0, ret.socket, true);

    return WASI.errno.ESUCCESS;
  }

  /**
   * @param {!WASI_t.fd} sock
   * @param {!WASI_t.s32} domain
   * @param {!WASI_t.pointer} addr_ptr
   * @param {!WASI_t.u16} port
   * @return {!WASI_t.errno}
   */
  sys_sock_bind(sock, domain, addr_ptr, port) {
    let address;
    switch (domain) {
      case Constants.AF_INET: {
        const dv = this.getView_(addr_ptr, 4);
        const bytes = this.getMem_(addr_ptr, addr_ptr + 4);
        // If address is within the fake range (0.0.0.0/8), pass it as an
        // integer to look up the real host later.
        address = dv.getUint32(0, true);
        if (address >= 0x1000000) {
          address = bytes.join('.');
        }
        break;
      }

      case Constants.AF_INET6: {
        const bytes = this.getMem_(addr_ptr, addr_ptr + 16);
        if (bytes[0] === 1) {
          // If address is within the fake range (100::/64), pass it as an
          // integer to look up the real host later.
          address = bytes[15];
        } else {
          // TODO(vapier): Check endianness; might need DataView via getView_().
          const u16 = new Uint16Array(bytes.buffer, bytes.bytesOffset, 8);
          address = Array.from(u16).map(
              (b) => b.toString(16).padStart(4, '0')).join(':');
        }
        break;
      }

      default:
        return WASI.errno.EAFNOSUPPORT;
    }
    return this.handle_sock_bind(sock, address, port);
  }

  /**
   * @param {!WASI_t.fd} sock
   * @param {!WASI_t.s32} backlog
   * @return {!WASI_t.errno}
   */
  sys_sock_listen(sock, backlog) {
    return this.handle_sock_listen(sock, backlog);
  }

  /**
   * @param {!WASI_t.s32} idx
   * @param {!WASI_t.pointer} name_ptr
   * @param {!WASI_t.size} namelen
   * @return {!WASI_t.errno}
   */
  sys_sock_register_fake_addr(idx, name_ptr, namelen) {
    const td = new TextDecoder();
    const buf = this.getMem_(name_ptr, name_ptr + namelen);
    const name = td.decode(buf);
    return this.handle_sock_register_fake_addr(idx, name);
  }

  /**
   * @param {!WASI_t.pointer} sock_ptr
   * @param {!WASI_t.s32} domain
   * @param {!WASI_t.s32} type
   * @param {!WASI_t.s32} protocol
   * @return {!WASI_t.errno}
   */
  sys_sock_create(sock_ptr, domain, type, protocol) {
    const ret = this.handle_sock_create(domain, type, protocol);
    if (typeof ret === 'number') {
      return ret;
    }

    const dv = this.getView_(sock_ptr, 4);
    dv.setUint32(0, ret.socket, true);
    return WASI.errno.ESUCCESS;
  }

  /**
   * @param {!WASI_t.fd} sock
   * @param {!WASI_t.s32} domain
   * @param {!WASI_t.pointer} addr_ptr
   * @param {!WASI_t.u16} port
   * @return {!WASI_t.errno}
   */
  sys_sock_connect(sock, domain, addr_ptr, port) {
    let address;
    const td = new TextDecoder();
    switch (domain) {
      case Constants.AF_UNIX: {
        // NB: We use port to pass the max length of the UNIX path buffer.
        let sun_path = this.getMem_(addr_ptr, addr_ptr + port);
        let nul = sun_path.indexOf(0);
        if (nul === -1) {
          nul = port;
        }
        // Technically UNIX sockets don't need to be UTF-8, but this simplifies
        // for us humans, and our programs will always be UTF-8 compliant.
        sun_path = sun_path.subarray(0, nul);
        address = td.decode(sun_path);
        break;
      }

      case Constants.AF_INET: {
        const dv = this.getView_(addr_ptr, 4);
        const bytes = this.getMem_(addr_ptr, addr_ptr + 4);
        // If address is within the fake range (0.0.0.0/8), pass it as an
        // integer to look up the real host later.
        address = dv.getUint32(0, true);
        if (address >= 0x1000000) {
          address = bytes.join('.');
        }
        break;
      }

      case Constants.AF_INET6: {
        const bytes = this.getMem_(addr_ptr, addr_ptr + 16);
        if (bytes[0] === 1) {
          // If address is within the fake range (100::/64), pass it as an
          // integer to look up the real host later.
          address = bytes[15];
        } else {
          // TODO(vapier): Check endianness; might need DataView via getView_().
          const u16 = new Uint16Array(bytes.buffer, bytes.bytesOffset, 8);
          address = Array.from(u16).map(
              (b) => b.toString(16).padStart(4, '0')).join(':');
        }
        break;
      }

      default:
        return WASI.errno.EAFNOSUPPORT;
    }
    return this.handle_sock_connect(sock, address, port);
  }

  /**
   * @param {!WASI_t.fd} sock
   * @param {!WASI_t.pointer} family_ptr
   * @param {!WASI_t.pointer} port_ptr
   * @param {!WASI_t.pointer} addr_ptr
   * @param {!WASI_t.size} remote
   * @return {!WASI_t.errno}
   */
  sys_sock_get_name(sock, family_ptr, port_ptr, addr_ptr, remote) {
    const ret = this.handle_sock_get_name(sock, remote);
    if (typeof ret === 'number') {
      return ret;
    }

    const dvFamily = this.getView_(family_ptr, 4);
    const dvPort = this.getView_(port_ptr, 2);
    let addrLen;

    switch (ret.family) {
      case Constants.AF_INET:
        addrLen = 4;
        break;

      case Constants.AF_INET6:
        addrLen = 16;
        break;

      default:
        return WASI.errno.EPROTONOSUPPORT;
    }

    dvFamily.setInt32(0, ret.family, true);
    dvPort.setUint16(0, ret.port, true);

    const bytes = this.getMem_(addr_ptr, addr_ptr + addrLen);
    bytes.set(ret.address);

    return WASI.errno.ESUCCESS;
  }

  /**
   * @param {!WASI_t.fd} sock
   * @param {!WASI_t.s32} level
   * @param {!WASI_t.s32} name
   * @param {!WASI_t.pointer} value_ptr
   * @return {!WASI_t.errno}
   */
  sys_sock_get_opt(sock, level, name, value_ptr) {
    const ret = this.handle_sock_get_opt(sock, level, name);
    if (typeof ret === 'number') {
      return ret;
    }

    const dv = this.getView_(value_ptr);
    dv.setInt32(0, ret.option, true);
    return WASI.errno.ESUCCESS;
  }

  /**
   * @param {!WASI_t.fd} sock
   * @param {!WASI_t.s32} level
   * @param {!WASI_t.s32} name
   * @param {!WASI_t.s32} value
   * @return {!WASI_t.errno}
   */
  sys_sock_set_opt(sock, level, name, value) {
    return this.handle_sock_set_opt(sock, level, name, value);
  }

  /**
   * @param {!WASI_t.fd} sock
   * @param {!WASI_t.pointer} buf_ptr
   * @param {!WASI_t.size} buf_len
   * @param {!WASI_t.pointer} nwritten_ptr
   * @param {!WASI_t.s32} flags
   * @param {!WASI_t.pointer} domain_ptr
   * @param {!WASI_t.pointer} addr_ptr
   * @param {!WASI_t.pointer} port_ptr
   * @return {!WASI_t.errno}
   */
  sys_sock_recvfrom(sock, buf_ptr, buf_len, nwritten_ptr, flags, domain_ptr,
                    addr_ptr, port_ptr) {
    if (flags & ~(Constants.MSG_DONTWAIT)) {
      return WASI.errno.EINVAL;
    }

    const ret = this.handle_sock_recvfrom(sock, buf_len, flags);
    if (typeof ret === 'number') {
      return ret;
    }

    const bytes = this.getMem_(buf_ptr, buf_ptr + buf_len);
    bytes.set(ret.buf);

    const dvWritten = this.getView_(nwritten_ptr, 4);
    dvWritten.setUint32(0, ret.buf.length, true);

    if (domain_ptr) {
      const dv = this.getView_(domain_ptr, 4);
      dv.setUint32(0, ret.domain, true);
    }

    if (addr_ptr) {
      let addrLen;
      switch (ret.domain) {
        case Constants.AF_INET:
          addrLen = 4;
          break;
        case Constants.AF_INET6:
          addrLen = 16;
          break;
      }
      if (addrLen !== undefined) {
        const bytes = this.getMem_(addr_ptr, addr_ptr + addrLen);
        bytes.set(ret.address);
      }
    }

    if (port_ptr) {
      const dv = this.getView_(port_ptr, 2);
      dv.setUint16(0, ret.port, true);
    }

    return WASI.errno.ESUCCESS;
  }

  /**
   * @param {!WASI_t.fd} sock
   * @param {!WASI_t.pointer} buf_ptr
   * @param {!WASI_t.size} buf_len
   * @param {!WASI_t.pointer} nwritten_ptr
   * @param {!WASI_t.s32} flags
   * @param {!WASI_t.s32} domain
   * @param {!WASI_t.pointer} addr_ptr
   * @param {!WASI_t.u16} port
   * @return {!WASI_t.errno}
   */
  sys_sock_sendto(sock, buf_ptr, buf_len, nwritten_ptr, flags, domain, addr_ptr,
                  port) {
    if (flags & ~(Constants.MSG_DONTWAIT)) {
      return WASI.errno.EINVAL;
    }

    let address;
    switch (domain) {
      case Constants.AF_INET: {
        const dv = this.getView_(addr_ptr, 4);
        const bytes = this.getMem_(addr_ptr, addr_ptr + 4);
        // If address is within the fake range (0.0.0.0/8), pass it as an
        // integer to look up the real host later.
        address = dv.getUint32(0, true);
        if (address >= 0x1000000) {
          address = bytes.join('.');
        }
        break;
      }

      case Constants.AF_INET6: {
        const bytes = this.getMem_(addr_ptr, addr_ptr + 16);
        if (bytes[0] === 1) {
          // If address is within the fake range (100::/64), pass it as an
          // integer to look up the real host later.
          address = bytes[15];
        } else {
          // TODO(vapier): Check endianness; might need DataView via getView_().
          const u16 = new Uint16Array(bytes.buffer, bytes.bytesOffset, 8);
          address = Array.from(u16).map(
              (b) => b.toString(16).padStart(4, '0')).join(':');
        }
        break;
      }

      default:
        return WASI.errno.EAFNOSUPPORT;
    }

    const buf = this.getMem_(buf_ptr, buf_ptr + buf_len);

    const ret = this.handle_sock_sendto(
        sock, buf, flags, domain, address, port);
    if (typeof ret === 'number') {
      return ret;
    }

    const dvWritten = this.getView_(nwritten_ptr, 4);
    dvWritten.setUint32(0, ret.nwritten, true);

    return WASI.errno.ESUCCESS;
  }

  /**
   * @param {!WASI_t.fd} oldfd
   * @param {!WASI_t.pointer} newfd_ptr
   * @return {!WASI_t.errno}
   */
  sys_fd_dup(oldfd, newfd_ptr) {
    const ret = this.handle_fd_dup(oldfd);
    if (typeof ret === 'number') {
      return ret;
    }

    const dv = this.getView_(newfd_ptr);
    dv.setFd(0, ret.fd, true);
    return WASI.errno.ESUCCESS;
  }

  /**
   * @param {!WASI_t.fd} oldfd
   * @param {!WASI_t.fd} newfd
   * @return {!WASI_t.errno}
   */
  sys_fd_dup2(oldfd, newfd) {
    return this.handle_fd_dup2(oldfd, newfd);
  }

  /**
   * Get the terminal window size.
   *
   * @param {!WASI_t.fd} fd Open file descriptor bound to the tty.
   * @param {!WASI_t.pointer} winsize_ptr Pointer to struct to store results.
   * @return {!WASI_t.errno}
   */
  sys_tty_get_window_size(fd, winsize_ptr) {
    const ret = this.handle_tty_get_window_size(fd);
    if (typeof ret === 'number') {
      return ret;
    }

    // Structure is 4 shorts (16-bit) values.
    const dv = this.getView_(winsize_ptr);
    dv.setUint16(0, ret.row, true);
    dv.setUint16(2, ret.col, true);
    dv.setUint16(4, ret.xpixel, true);
    dv.setUint16(6, ret.ypixel, true);
    return WASI.errno.ESUCCESS;
  }

  /**
   * Set the terminal window sie
   *
   * @param {!WASI_t.fd} fd Open file descriptor bound to the tty.
   * @param {!WASI_t.pointer} winsize_ptr Pointer to struct to store results.
   * @return {!WASI_t.errno}
   */
  sys_tty_set_window_size(fd, winsize_ptr) {
    // Not sure we want to support this.
    return WASI.errno.ENOTTY;
  }

  /**
   * Display a message to the user and get their response.
   *
   * @param {!WASI_t.pointer} prompt_ptr Pointer to the string to display to the
   *     user.
   * @param {!WASI_t.size} prompt_len Length (in bytes) of message.
   * @param {!WASI_t.pointer} buf_ptr Pointer to buffer for user's input.
   * @param {!WASI_t.size} buf_len Length (in bytes) of user's input.
   * @param {!WASI_t.s32} echo Whether the user's input should be hidden.
   * @return {!WASI_t.errno}
   */
  sys_readpassphrase(prompt_ptr, prompt_len, buf_ptr, buf_len, echo) {
    let prompt = '';
    if (prompt_ptr) {
      const td = new TextDecoder();
      const prompt_buf = this.getMem_(prompt_ptr, prompt_ptr + prompt_len);
      try {
        prompt = td.decode(prompt_buf);
      } catch (e) {
        return WASI.errno.EFAULT;
      }
    }

    const ret = this.handle_readpassphrase(prompt, buf_len - 1, !!echo);
    if (typeof ret === 'number') {
      return ret;
    }

    const buf = this.getMem_(buf_ptr, buf_ptr + buf_len);
    const te = new TextEncoder();
    const written = te.encodeInto(ret.pass, buf).written;
    buf[written] = 0;
    return WASI.errno.ESUCCESS;
  }
}
