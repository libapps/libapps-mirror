// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview WASM-specific module logic.
 * @suppress {moduleLoad}
 * @suppress {checkTypes} FileHandle$$module$wassh$js$vfs naming confusion.
 */

import {lib} from '../../libdot/index.js';

import {hterm} from '../../hterm/index.js';

import {sanitizeScriptUrl} from './nassh.js';
import {Agent} from './nassh_agent.js';
import {getIndexeddbFileSystem} from './nassh_fs.js';
import {Relay} from './nassh_relay.js';
import {Stream} from './nassh_stream.js';
import {StreamSet} from './nassh_stream_set.js';
import {SshAgentStream} from './nassh_stream_sshagent.js';
import {SshAgentRelayStream} from './nassh_stream_sshagent_relay.js';

import {WASI} from '../../wasi-js-bindings/index.js';

import * as WasshProcess from '../wassh/js/process.js';
import {cleanupChromeSockets} from '../wassh/js/sockets.js';
import * as WasshSyscallHandler from '../wassh/js/syscall_handler.js';
import {FileHandle, FileHandler} from '../wassh/js/vfs.js';

/**
 * A write-only pipe.
 *
 * WASM writes to this handle, and the handle writes to our SFTP client which
 * processes the packets.
 *
 * TODO(vapier): Generalize this and move to wassh.vfs?
 */
class SftpPipeWriteHandle extends FileHandle {
  constructor(path, client) {
    // TODO(vapier): This should really be FIFO, but WASI doesn't define that?
    super(path, WASI.filetype.CHARACTER_DEVICE);
    this.client_ = client;
  }

  write(buf) {
    this.client_.writeStreamData(buf);
    return {nwritten: buf.length};
  }

  /** @override */
  async pwrite(buf, offset) {
    return WASI.errno.ESPIPE;
  }

  /** @override */
  async read(length) {
    return WASI.errno.ESPIPE;
  }

  /** @override */
  async pread(length, offset) {
    return WASI.errno.ESPIPE;
  }

  /** @override */
  tell() {
    return WASI.errno.ESPIPE;
  }
}

/**
 * A read-only pipe.
 *
 * Our SFTP client queues packets (via write() calls) for WASM to read.
 *
 * TODO(vapier): Generalize this and move to wassh.vfs?
 */
class SftpPipeReadHandle extends FileHandle {
  constructor(path, handler) {
    // TODO(vapier): This should really be FIFO, but WASI doesn't define that?
    super(path, WASI.filetype.CHARACTER_DEVICE);
    this.handler = handler;
  }

  /** @override */
  write(buf) {
    buf = new Uint8Array(buf);
    const data = new Uint8Array(this.data.length + buf.length);
    data.set(this.data);
    data.set(buf, this.data.length);
    this.data = data;
    if (this.handler.notify_) {
      this.handler.notify_();
    }
    return {nwritten: buf.length};
  }

  /** @override */
  async pwrite(buf, offset) {
    return WASI.errno.ESPIPE;
  }

  /** @override */
  async read(length) {
    const buf = this.data.slice(0, length);
    this.data = this.data.subarray(length);
    return {buf};
  }

  /** @override */
  async pread(length, offset) {
    return WASI.errno.ESPIPE;
  }

  /** @override */
  tell() {
    return WASI.errno.ESPIPE;
  }
}

/**
 * A path backed by a key in a specific lib.Storage.
 *
 * This is how we sync files.
 *
 * TODO(vapier): Generalize this and move to wassh.vfs?
 */
class StorageFileHandle extends FileHandle {
  /**
   * @param {string} path The absolute path in the filesystem for this handler.
   * @param {!WASI_t.filetype=} filetype The WASI filetype.
   * @param {!lib.Storage} storage The backing storage for file content.
   * @param {string} key The storage item name.
   */
  constructor(path, filetype, storage, key) {
    super(path, filetype);

    this.storage_ = storage;
    this.key_ = key;
  }

  /** @override */
  async init() {
    const data = await this.storage_.getItem(this.key_) ?? '';
    this.data = lib.codec.stringToCodeUnitArray(data);
  }

  /** @override */
  async write(buf) {
    return WASI.errno.EROFS;
  }

  /** @override */
  async pwrite(buf, offset) {
    return WASI.errno.EROFS;
  }
}

/**
 * A path backed by a key in a specific lib.Storage.
 *
 * This is how we sync files.
 *
 * TODO(vapier): Generalize this and move to wassh.vfs?
 */
class StorageFileHandler extends FileHandler {
  /**
   * @param {string} path The absolute path in the filesystem for this handler.
   * @param {!lib.Storage} storage The backing storage for file content.
   * @param {string} key The storage item name.
   */
  constructor(path, storage, key) {
    super(path, WASI.filetype.REGULAR_FILE, StorageFileHandle);

    this.storage_ = storage;
    this.key_ = key;
  }

  /** @override */
  async open(path, fs_flags, o_flags) {
    if (path !== this.path) {
      return WASI.errno.ENOTDIR;
    }
    const ret = new this.handleCls(
        this.path, this.filetype, this.storage_, this.key_);
    await ret.init();
    return ret;
  }
}

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
   *   relay: ?Relay,
   *   isSftp: (boolean|undefined),
   *   sftpClient: (?Object|undefined),
   *   secureInput: function(string, number, boolean),
   * }} opts
   */
  constructor({executable, argv, environ, terminal, trace, authAgent,
               authAgentAppID, relay, isSftp, sftpClient, secureInput,
               syncStorage}) {
    this.executable_ = executable;
    this.argv_ = argv;
    this.environ_ = environ;
    this.terminal_ = terminal;
    this.trace_ = trace === undefined ? false : trace;
    this.authAgent_ = authAgent;
    this.authAgentAppID_ = authAgentAppID;
    this.relay_ = relay;
    this.isSftp_ = isSftp;
    this.sftpClient_ = sftpClient;
    this.secureInput_ = secureInput;
    this.syncStorage_ = syncStorage;
    this.plugin_ = null;
    this.sftpStdin_ = null;
    this.sftpStdout_ = null;
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

    // Tell OpenSSH to use the sftp subsystem instead of an interactive session.
    if (this.isSftp_) {
      this.argv_.push('-s');
      this.argv_.push('sftp');
    }

    this.terminal_.io.print(
        ' «««This is in beta -- see https://issuetracker.google.com/40220462 ' +
        'for KIs»»»');

    const settings = {
      executable: this.executable_,
      argv: [this.executable_, ...this.argv_],
      environ: this.environ_,
      handler: new WasshSyscallHandler.RemoteReceiverWasiPreview1({
        fileSystem: await getIndexeddbFileSystem(),
        term: this.terminal_,
        tcpSocketsOpen: this.relay_
            ? (address, port) => this.openTcpSocket_(address, port)
            : null,
        unixSocketsOpen: (address, port) => this.openUnixSocket_(address, port),
        secureInput: this.secureInput_,
      }),
    };
    await settings.handler.init();

    const vfs = settings.handler.vfs;
    vfs.addHandler(new StorageFileHandler(
        '/etc/ssh/ssh_config', this.syncStorage_, '/nassh/etc/ssh/ssh_config'));
    vfs.addHandler(new StorageFileHandler(
        '/etc/ssh/ssh_known_hosts', this.syncStorage_,
        '/nassh/etc/ssh/ssh_known_hosts'));

    // If this is an SFTP connection, rebind stdin/stdout to our custom pipes
    // which connect to our JS SFTP client.
    if (this.isSftp_) {

      this.sftpStdin_ = new SftpPipeReadHandle('sftp-in', settings.handler);
      let fd = vfs.openHandle(this.sftpStdin_);
      if (fd != 0) {
        vfs.fds_.dup2(fd, 0);
        vfs.close(fd);
      }

      this.sftpStdout_ = new SftpPipeWriteHandle('sftp-out', this.sftpClient_);
      fd = vfs.openHandle(this.sftpStdout_);
      if (fd != 1) {
        vfs.fds_.dup2(fd, 1);
        vfs.close(fd);
      }
    }

    this.plugin_ = new WasshProcess.Background(
        sanitizeScriptUrl(`../wassh/js/worker.js?trace=${this.trace_}`),
        settings);
  }

  /**
   * Run the plugin.
   *
   * @return {!Promise<number>} The exit status of the program.
   */
  async run() {
    return this.plugin_.run();
  }

  /**
   * Remove the plugin from the page.
   */
  remove() {
    // TODO(vapier): Should close all streams upon exit.
    this.plugin_.terminate();
    this.plugin_ = null;
    // TODO(vapier): This should be automatic in the plugin termination.
    cleanupChromeSockets();
  }

  /**
   * Write data to the plugin.
   *
   * @param {number} fd The file handle to write to.
   * @param {!ArrayBuffer} data The content to write.
   */
  async writeTo(fd, data) {
    const ret = await this.plugin_.writeTo(fd, data);
    if (typeof ret === 'number') {
      console.error(`Unable to write to plugin fd ${fd}: ${ret}`);
    }
  }

  /**
   * Hijack initial TCP connection if relay is requested.
   *
   * @param {string} address The remote server to connect to.
   * @param {number} port The remote port to connect to.
   * @return {!Promise<!Stream>} The new relay socket stream.
   */
  async openTcpSocket_(address, port) {
    // We're only ever going to have one relay, so construct the stream set &
    // use a fake fd below in it.  After we turn down the NaCl code, we can
    // refactor the stream APIs entirely to avoid this.
    const streams = new StreamSet();
    let stream;
    await new Promise((resolve) => {
      stream = this.relay_.openSocket(9, address, port, streams, resolve);
    });
    return stream;
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
