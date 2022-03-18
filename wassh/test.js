// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {Process, SyscallEntry} from '../wasi-js-bindings/index.js';
import * as WasshSyscallEntry from './js/syscall_entry.js';
import * as WasshSyscallHandler from './js/syscall_handler.js';

window.onload = async function() {
  await lib.init();

  const term = new hterm.Terminal();
  term.onTerminalReady = run;
  term.setAutoCarriageReturn(true);
  term.decorate(document.querySelector('#terminal'));
  term.installKeyboard();
  window.term_ = term;
};

/**
 * Callback by terminal init.
 */
const run = async function() {
  const params = new URLSearchParams(document.location.search);
  const trace = (params.get('trace') ?? 'false') === 'true';
  const user = params.get('user') ?? 'vapier';
  const host = params.get('host') ?? 'penguin.linux.test';
  const port = params.get('port') ?? '22';

  const io = this.io.push();

  const foreground = false;

  // Path is relative to the worker.js file below.
  const prefix = foreground ? '.' : '..';
//  const prog = 'test.wasm';
//  const prog = '../ssh_client/output/plugin/wasm/ssh-keygen.wasm';
//  const prog = '../ssh_client/output/plugin/wasm/ssh.wasm';
//  const prog = '../ssh_client/output/build/wasm/openssh-8.8p1/work/openssh-8.8p1/ssh';
  const prog = '../plugin/wasm/ssh.wasm';
//  const prog = '../wassh/test/socket.wasm';
  const argv = [
//    prog, '--help',
//    prog, '-t', 'ed25519', '-f', 'id_ed25519', '-N', '',
//    prog, '-vvv', 'root@127.0.0.1',
//    prog, '-vvv', 'root@localhost',
//    prog, '-vvv', 'root@localhost.localdomain',
//    prog, '-vvv', 'vapier@100.115.92.194',
    prog, '-vvv', '-6', `-p${port}`, `${user}@${host}`,
//    prog, '-vvv', '-6', 'root@localhost',
//    prog, '100.115.92.194',
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

  io.println(`> Loading ${prog}`);
  let proc;
  if (foreground) {
    const sys_handlers = [
      new WasshSyscallHandler.DirectWasiPreview1(),
    ];
    settings.sys_handlers = sys_handlers;
    settings.sys_entries = [
      new SyscallEntry.WasiPreview1({sys_handlers, trace}),
      new WasshSyscallEntry.WasshExperimental({}),
    ];
    proc = new Process.Foreground(settings);
  } else {
    settings.handler = new WasshSyscallHandler.RemoteReceiverWasiPreview1({
      term: this,
    });
    await settings.handler.init();
    proc = new Process.Background(
        `./js/worker.js?trace=${trace}`, settings);
  }
  io.println(`> Running ${prog} ${argv.slice(1).join(' ')}`);
  const ret = await proc.run();
  io.println(`\n> finished: ret = ${ret}`);
};
