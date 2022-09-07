// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview WASI JS Bindings main library entry point.
 */

// TODO(vapier): Switch to 'export * as' once closure support it.
import {WasiView} from './js/dataview.js';
import * as Process from './js/process.js';
import * as SyscallEntry from './js/syscall_entry.js';
import * as SyscallHandler from './js/syscall_handler.js';
import * as util from './js/util.js';
import * as WASI from './js/wasi.js';
import * as BackgroundWorker from './js/worker.js';
export {BackgroundWorker, Process, SyscallEntry, SyscallHandler, util, WASI,
        WasiView};
