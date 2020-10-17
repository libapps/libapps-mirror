// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Handlers for the custom wassh syscalls.
 * @suppress {moduleLoad}
 * @suppress {checkTypes} module$__$wasi_js_bindings$js naming confusion.
 */

import * as SyscallEntry from '../../wasi-js-bindings/js/syscall_entry.js';
import * as WASI from '../../wasi-js-bindings/js/wasi.js';

/**
 * WASSH syscall extensions.
 */
export class WasshExperimental extends SyscallEntry.Base {
  constructor(runtime) {
    super(runtime);
    this.namespace = 'wassh_experimental';
  }

  sys_sock_create(sock, domain, type) {
    return WASI.errno.ENOSYS;
  }

  sys_sock_connect(sock, domain, addr, port) {
    return WASI.errno.ENOSYS;
  }

  sys_fd_dup(oldfd, newfd_ptr) {
    const ret = this.handle_fd_dup(oldfd);
    if (typeof ret === 'number') {
      return ret;
    }

    const dv = this.getView_(newfd_ptr);
    dv.setFd(0, ret.fd, true);
    return WASI.errno.ESUCCESS;
  }

  sys_fd_dup2(oldfd, newfd) {
    return this.handle_fd_dup2(oldfd, newfd);
  }
}
