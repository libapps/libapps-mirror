// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview
 */

import * as BackgroundWorker from '../../wasi-js-bindings/js/worker.js';
import * as Process from '../../wasi-js-bindings/js/process.js';
import * as SyscallEntry from '../../wasi-js-bindings/js/syscall_entry.js';
import * as SyscallHandler from '../../wasi-js-bindings/js/syscall_handler.js';
import * as WasshSyscallEntry from './syscall_entry.js';
import * as WasshSyscallHandler from './syscall_handler.js';

class WasshWorker extends BackgroundWorker.Base {
  newProcess(executable, argv, environ, sab, handler_ids) {
    const sys_handlers = [
      new SyscallHandler.ProxyWasiUnstable(this, sab, handler_ids),
      new WasshSyscallHandler.DirectWasiUnstable(),
    ];
    const sys_entries = [
      new SyscallEntry.WasiUnstable({sys_handlers, trace: true}),
      new WasshSyscallEntry.WasshExperimental({}),
    ];
    return new Process.Foreground({executable, argv, environ, sys_handlers, sys_entries});
  }
}

const wassh_worker = new WasshWorker(globalThis);
wassh_worker.bind();
