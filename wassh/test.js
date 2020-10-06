// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Process from '../../wasi-js-bindings/js/process.js';
import * as SyscallEntry from '../../wasi-js-bindings/js/syscall_entry.js';
import * as WasshSyscallEntry from './js/syscall_entry.js';
import * as WasshSyscallHandler from './js/syscall_handler.js';

window.onload = async function() {
  const term = document.getElementById('terminal');

  const foreground = false;

  // Path is relative to the worker.js file below.
  const prefix = foreground ? '.' : '..';
//  const prog = 'test.wasm';
  const prog = '../ssh_client/output/plugin/wasm/ssh-keygen.wasm';
//  const prog = '../ssh_client/output/plugin/wasm/ssh.wasm';
  const argv = [
//    prog, '--help',
    prog, '-t', 'ed25519', '-f', 'id_ed25519', '-N', '',
  ];
  const environ = {
    'HOME': '/',
    'USER': 'wassh',
    'TERM': 'xterm',
  };

  const settings = {
    executable: `${prefix}/${prog}`,
    argv: argv,
    environ: environ,
  };

  term.innerText += `> Loading ${prog}\n`;
  let proc;
  if (foreground) {
    const sys_handlers = [
      new WasshSyscallHandler.DirectWasiPreview1(),
    ];
    settings.sys_handlers = sys_handlers;
    settings.sys_entries = [
      new SyscallEntry.WasiPreview1({sys_handlers, trace: true}),
      new WasshSyscallEntry.WasshExperimental({}),
    ];
    proc = new Process.Foreground(settings);
  } else {
    settings.handler = new WasshSyscallHandler.RemoteReceiverWasiPreview1();
    proc = new Process.Background('./js/worker.js', settings);
  }
  term.innerText += `> Running ${prog}\n`;
  const ret = await proc.run();
  term.innerText += `\n> finished: ret = ${ret}`;
};
