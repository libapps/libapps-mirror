// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {hterm} from '../../nassh/js/deps_local.concat.js';
import {SyscallEntry} from '../../wasi-js-bindings/index.js';
import * as WasshProcess from '../js/process.js';
import * as WasshSyscallEntry from '../js/syscall_entry.js';
import * as WasshSyscallHandler from '../js/syscall_handler.js';

window.onload = async function() {
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
  const debug = trace;
  const user = params.get('user') ?? 'vapier';
  const host = params.get('host') ?? 'penguin.linux.test';
  const port = params.get('port') ?? '22';

  const io = this.io.push();
  io.onTerminalResize = (width, height) => {
    // https://github.com/WebAssembly/wasi-libc/issues/272
    proc.send_signal(28 /* musl SIGWINCH */);
  };

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
//    prog, 'root@127.0.0.1',
//    prog, 'root@localhost',
//    prog, 'root@localhost.localdomain',
//    prog, 'vapier@100.115.92.194',
    prog, `-p${port}`, `${user}@${host}`,
//    prog, '-6', 'root@localhost',
//    prog, '100.115.92.194',
  ];
  const environ = {
    'HOME': '/',
    'USER': 'wassh',
    'TERM': 'xterm',
  };
  if (debug) {
    argv.splice(1, 0, '-vvv');
  }

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
      new SyscallEntry.WasiPreview1({sys_handlers, trace, debug}),
      new WasshSyscallEntry.WasshExperimental({}),
    ];
    proc = new Process.Foreground(settings);
  } else {
    settings.handler = new WasshSyscallHandler.RemoteReceiverWasiPreview1({
      term: this,
      tcpSocketsOpen: async (address, port) => {
        // If running in the extension, assume raw TCP connection.
        if (window?.chrome?.sockets) {
          return false;
        }

        // For all others, fallback to using a WebSocket proxy.
        const stream = new WebsockifyStream(address, port);
        await stream.connect_();
        return stream;
      },
      unixSocketsOpen: (address, port) => null,
      secureInput: (prompt, max_len, echo) => secureInput(io, echo),
    });
    await settings.handler.init();
    proc = new WasshProcess.Background(
        `./js/worker.js?trace=${trace}`, settings);
  }
  io.println(`> Running ${prog} ${argv.slice(1).join(' ')}`);
  const ret = await proc.run();
  io.println(`\n> finished: ret = ${ret}`);
};

function secureInput(io, echo) {
  return new Promise((resolve) => {
    io = io.push();
    let pass = '';
    io.onVTKeystroke = (str) => {
      if (echo) {
        io.print(str);
      }
      switch (str) {
        case '\x7f':
        case '\x08':
          pass = pass.slice(0, -1);
          break;
          case '\n':
          case '\r':
            resolve(pass);
            io.pop();
            break;
          default:
            pass += str;
            break;
      }
    };
  });
}

/**
 * Promise wrapper for setTimeout.
 *
 * @param {number} timeout How long (in milliseconds) to sleep.
 */
function sleep(timeout = 1) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

/**
 * Simple buffer on top of WebSockets.
 */
class WebsockifyStream {
  /**
   * @param {host} string
   * @param {port} number
   */
  constructor(host, port, protocol = 'ws') {
    this.host_ = host;
    this.port_ = port;
    this.protocol_ = protocol;

    // The actual WebSocket connected to the ssh server.
    this.socket_ = null;

    // How much data we'll let queue in the websocket before we hold off.
    this.maxWebSocketBufferLength = 64 * 1024;
  }

  /**
   * Start a new connection to the proxy server.
   */
  async connect_() {
    if (this.socket_) {
      throw new Error('stream already connected');
    }

    const uri = `${this.protocol_}://${this.host_}:${this.port_}`;
    this.socket_ = new WebSocket(uri);
    this.socket_.binaryType = 'arraybuffer';
    this.socket_.onmessage = this.onSocketData_.bind(this);
    this.socket_.onclose = this.onSocketClose_.bind(this);
    this.socket_.onerror = this.onSocketError_.bind(this);

    await new Promise((resolve) => {
      this.socket_.onopen = resolve;
    });
  }

  /**
   * Close the connection to the proxy server and clean up.
   *
   * @param {string} reason A short message explaining the reason for closing.
   */
  close(reason = '???') {
    // If we aren't open, there's nothing to do.  This allows us to call it
    // multiple times, perhaps from cascading events (write error/close/etc...).
    if (!this.socket_) {
      return;
    }

    console.log(`Closing socket due to ${reason}`);
    this.socket_.close();
    this.socket_ = null;
  }

  /**
   * Callback when the socket closes when the connection is finished.
   *
   * @param {!CloseEvent} e The event details.
   */
  onSocketClose_(e) {
    this.close(`server closed socket: [${e.code}] ${e.reason}`);
  }

  /**
   * Callback when the socket closes due to an error.
   *
   * @param {!Event} e The event details.
   */
  onSocketError_(e) {
    this.close(`server sent an error: ${e}`);
  }

  /**
   * Callback when new data is available from the server.
   *
   * @param {!MessageEvent} e The message with data to read.
   */
  onSocketData_(e) {
    this.onDataAvailable(e.data);
  }

  /**
   * Queue up some data to write asynchronously.
   *
   * @param {!ArrayBuffer} data The SSH data.
   * @param {function(number)=} onSuccess Optional callback.
   * @override
   */
  async asyncWrite(data) {
    if (!data.byteLength) {
      return;
    }

    // If we've queued too much already, go back to sleep.
    // NB: This check is fuzzy at best, so we don't need to include the size of
    // the data we're about to write below into the calculation.
    while (this.socket_.bufferedAmount >= this.maxWebSocketBufferLength) {
      await sleep(10);
    }

    this.socket_.send(data);
  }
}
