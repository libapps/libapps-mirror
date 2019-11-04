// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {SyscallHandler} from './syscall_handler.js';

window.onload = async function() {
  const term = document.getElementById('terminal');

  const handler = new SyscallHandler();

  const consoleEvent = function(e) {
    const type = e.data.type;
    // Communication from the worker currently either takes the form of an
    // update to the terminal (e.g. output of printf) or a request to satisfy a
    // syscall.
    if (type === 'console_event') {
      term.innerText += e.data.message;
    } else if (type === 'syscall') {
      // dispatch to syscallhandler
      handler.inbound(e);
    } else {
      console.error(`ERROR: Received unhandled message from worker : ${e}`);
    }
  };

  // Construct our WASM runtime on a separate worker thread. The
  // '{type:'module'}' syntax requires Chrome 80 or the
  // --enable-experimental-web-platform-features flag to be set.
  const w = new Worker('./wassh_wasi_runtime.js', {type: 'module'});
  w.addEventListener('message', consoleEvent, false);

  // To start the runtime the path to the wasm program is required, as well as
  // the shared memory of the lock inside the SyscallHandler instance. The
  // worker will construct their own SyscallLock instance using this shared
  // memory, enabling the worker to lock()/wait() and the SyscallHandler
  // instance to unlock() the worker, signalling that it can continue execution.
  w.postMessage({type: 'run', prog_path: './test.wasm', lock_sab: handler.sab});
};
