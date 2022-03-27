// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview WASM-specific module logic.
 * @suppress {moduleLoad}
 */

import {Agent} from './nassh_agent.js';
import {Stream} from './nassh_stream.js';
import {SshAgentStream} from './nassh_stream_sshagent.js';
import {SshAgentRelayStream} from './nassh_stream_sshagent_relay.js';

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
   *   authAgent: ?Agent,
   *   authAgentAppID: string,
   * }} opts
   */
  constructor({executable, argv, environ, terminal, trace, authAgent,
               authAgentAppID}) {
    this.executable_ = executable;
    this.argv_ = argv;
    this.environ_ = environ;
    this.terminal_ = terminal;
    this.trace_ = trace === undefined ? false : trace;
    this.authAgent_ = authAgent;
    this.authAgentAppID_ = authAgentAppID;
  }

  /**
   * @return {!Promise<void>} When the plugin has been initialized.
   * @suppress {checkTypes} module$__$wasi_js_bindings$js naming confusion.
   */
  async init() {
    if (this.authAgentAppID_) {
      // OpenSSH-7.3 added -oIdentityAgent, but SSH_AUTH_SOCK has been supported
      // forever, so use that.  Also allows people to set IdentityAgent via the
      // ssh_config file.
      this.environ_['SSH_AUTH_SOCK'] = `/AF_UNIX/agent/${this.authAgentAppID_}`;
    }

    const settings = {
      executable: this.executable_,
      argv: this.argv_,
      environ: this.environ_,
      handler: new WasshSyscallHandler.RemoteReceiverWasiPreview1({
        term: this.terminal_,
        unixSocketsOpen: (address, port) => this.openUnixSocket_(address, port),
      }),
    };
    await settings.handler.init();
    this.plugin_ = new WasshProcess.Background(
        `../wassh/js/worker.js?trace=${this.trace_}`, settings);
    this.plugin_.run();
  }

  /**
   * Handle requests to open a UNIX socket.
   *
   * Currently only used to handle ssh-agent requests.
   *
   * @param {string} address The UNIX socket path.
   * @param {number} port The port to connect to (largely unused).
   * @return {!Promise<?Stream>} The new UNIX socket stream if available.
   */
  async openUnixSocket_(address, port) {
    let stream = null;
    let args;

    if (address === '127.1.2.3') {
      // TODO(crbug.com/1303495): Delete this old hack.
      if (this.authAgent_) {
        args = {authAgent: this.authAgent_};
        stream = new SshAgentStream(0, args);
      } else {
        args = {authAgentAppID: this.authAgentAppID_};
        stream = new SshAgentRelayStream(0);
      }
    }
    // TODO(vapier): Implement path-based lookups.

    if (stream) {
      // We handle this above, but closure compiler can't.
      lib.notUndefined(args);
      await stream.asyncOpen(args, (success, errorMessage) => {
        if (success) {
          stream.open = true;
        }
      });
    }

    return stream;
  }
}
