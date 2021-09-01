// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Handlers for the custom wassh syscalls.
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
}
