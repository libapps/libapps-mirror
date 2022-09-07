// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview
 * @suppress {moduleLoad}
 * @suppress {checkTypes} module$__$wasi_js_bindings$js naming confusion.
 */

import {
  BackgroundWorker, SyscallEntry, SyscallHandler,
} from '../../wasi-js-bindings/index.js';
import * as WasshProcess from './process.js';
import * as WasshSyscallEntry from './syscall_entry.js';

class WasshWorker extends BackgroundWorker.Base {
  newProcess(executable, argv, environ, sab, handler_ids) {
    const trace = (params.get('trace') ?? 'false') === 'true';
    const debug = trace;

    const sys_handlers = [
      new SyscallHandler.ProxyWasiPreview1(this, sab, handler_ids),
      new SyscallHandler.DirectWasiPreview1(),
    ];
    const sys_entries = [
      new SyscallEntry.WasiPreview1({sys_handlers, debug, trace}),
      new WasshSyscallEntry.WasshExperimental({sys_handlers, debug, trace}),
    ];
    return new WasshProcess.Foreground(
        {executable, argv, environ, sys_handlers, sys_entries, debug});
  }
}

const params = new URLSearchParams(location.search);
const wassh_worker = new WasshWorker(globalThis);
wassh_worker.bind();
