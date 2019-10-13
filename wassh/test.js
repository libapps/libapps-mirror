// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {WasshWasiRuntime} from './wassh_wasi_runtime.js';

window.onload = async function() {
  const term = document.getElementById('terminal');
  const write = function(str) {
    term.innerText += str;
  };

  const prog = './test.wasm';
//  const prog = '../ssh_client/output/plugin/wasm/ssh-keygen.wasm';
//  const prog = '../ssh_client/output/plugin/wasm/ssh.wasm';
  const runtime = new WasshWasiRuntime({
    argv: [prog, '--help'],
    environ: {
      'HOME': '/',
      'USER': 'wassh',
      'TERM': 'xterm',
    },
    io: {
      write: (str) => term.innerText += str,
      debug: (str) => console.log(str),
    },
  });

  const imports = {
    'wasi_unstable': {},
    'wassh_experimental': {},
  };
  // TODO(vapier): Not clear why we need to explicitly rebind.
  Object.keys(imports).forEach((api) => {
    Object.getOwnPropertyNames(runtime[api].__proto__).forEach((key) => {
      if (key.endsWith('_') || key == 'constructor') {
        return;
      }
      imports[api][key] = runtime[api][key].bind(runtime[api]);
    });
  });

  write(`> Loading ${prog}\n`);
  let instance;
  try {
    const result = await WebAssembly.instantiateStreaming(
        fetch(prog), imports
    );
    instance = result.instance;
    runtime.setInstance(instance);
  } catch (e) {
    write(`> Loading failure: ${e}\n`);
    return;
  }
  try {
    write(`> Running ${prog}\n`);
    instance.exports._start();
    // If we get here, the program returned 0 from main.
    // If it returned non-zero, or called exit() with any value (0 or nonzero),
    // then proc_exit will be used instead.
    write('\n> exited normally');
  } catch (e) {
    write(`\n> Runtime failure: ${e}\n${e.stack}`);
  }
};
