// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview WASM-specific module logic.
 * @suppress {moduleLoad}
 */

import * as WasshProcess from '../wassh/js/process.js';
import * as WasshSyscallHandler from '../wassh/js/syscall_handler.js';

/**
 * Plugin message handlers.
 */
export class Plugin {
  /**
   * @param {{
   *   executable: string,
   *   argv: !Array<string>,
   *   environ: !Object<string, string>,
   *   terminal: !hterm.Terminal,
   *   trace: (boolean|undefined),
   * }} opts
   */
  constructor({executable, argv, environ, terminal, trace}) {
    this.executable_ = executable;
    this.argv_ = argv;
    this.environ_ = environ;
    this.terminal_ = terminal;
    this.trace_ = trace === undefined ? false : trace;
  }

  /**
   * @return {!Promise<void>} When the plugin has been initialized.
   * @suppress {checkTypes} module$__$wasi_js_bindings$js naming confusion.
   */
  async init() {
    const settings = {
      executable: this.executable_,
      argv: this.argv_,
      environ: this.environ_,
      handler: new WasshSyscallHandler.RemoteReceiverWasiPreview1({
        term: this.terminal_,
      }),
    };
    await settings.handler.init();
    this.plugin_ = new WasshProcess.Background(
        `../wassh/js/worker.js?trace=${this.trace_}`, settings);
    this.plugin_.run();
  }
}
