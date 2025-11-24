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
import {newBuffer} from './nassh_buffer.js';
import {getIndexeddbFileSystem} from './nassh_fs.js';
import {Relay} from './nassh_relay.js';
import {Stream} from './nassh_stream.js';
import {SshAgentStream} from './nassh_stream_sshagent.js';
import {SshAgentRelayStream} from './nassh_stream_sshagent_relay.js';

import {WASI} from '../../wasi-js-bindings/index.js';

import * as WasshProcess from '../wassh/js/process.js';
import {cleanupChromeSockets} from '../wassh/js/sockets.js';
import * as WasshSyscallHandler from '../wassh/js/syscall_handler.js';
import {FileHandle, FileHandler} from '../wassh/js/vfs.js';

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

  /**
   * @param {!TypedArray} buf
   * @return {!Promise<!WASI_t.errno|{nwritten: number}>}
   * @override
   */
  async write(buf) {
    return WASI.errno.EROFS;
  }

  /**
   * @param {!TypedArray} buf
   * @param {number|bigint} offset
   * @return {!Promise<!WASI_t.errno|{nwritten: number}>}
   * @override
   */
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
export class StorageFileHandler extends FileHandler {
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

  /**
   * @param {string} path
   * @param {!WASI_t.fdflags} fdflags
   * @param {!WASI_t.oflags} o_flags
   * @return {!Promise<!WASI_t.errno|!PathHandle>}
   * @override
   */
  async open(path, fdflags, o_flags) {
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
 * A path in which we temporarily sync content of the file, but not store the
 * file.
 */
class MemoryFileHandle extends FileHandle {
  /**
   * @param {string} path The absolute path in the filesystem for this handler.
   * @param {string} content The content which we want to sync temporarily.
   */
  constructor(path, content) {
    super(path);

    this.content_ = content;
  }

  /** @override */
  async init() {
    this.data = lib.codec.stringToCodeUnitArray(this.content_);
  }

  /**
   * @param {!TypedArray} buf
   * @return {!Promise<!WASI_t.errno|{nwritten: number}>}
   * @override
   */
  async write(buf) {
    return WASI.errno.EROFS;
  }

  /**
   * @param {!TypedArray} buf
   * @param {number|bigint} offset
   * @return {!Promise<!WASI_t.errno|{nwritten: number}>}
   * @override
   */
  async pwrite(buf, offset) {
    return WASI.errno.EROFS;
  }
}

/**
 * A path in which we temporarily sync content of the file, but not store the
 * file.
 */
export class MemoryFileHandler extends FileHandler {
  /**
   * @param {string} path The absolute path in the filesystem for this handler.
   * @param {string} content The content which we want to sync temporarily.
   */
  constructor(path, content) {
    super(path, WASI.filetype.REGULAR_FILE, MemoryFileHandle);
    this.content_ = content;
  }

  /**
   * @param {string} path
   * @param {!WASI_t.fdflags} fdflags
   * @param {!WASI_t.oflags} o_flags
   * @return {!Promise<!WASI_t.errno|!PathHandle>}
   * @override
   */
  async open(path, fdflags, o_flags) {
    if (path !== this.path) {
      return WASI.errno.ENOTDIR;
    }
    const ret = new this.handleCls(path, this.content_);
    await ret.init();
    return ret;
  }
}

/**
 * A write-only pipe logger.
 *
 * Capture all the output written while passing it along.
 *
 * TODO(vapier): Generalize this and move to wassh.vfs?
 */
class LogPipeWriteHandle extends FileHandle {
  /**
   * @param {string} path The absolute path in the filesystem for this handler.
   * @param {!FileHandle} handle The handle to wrap.
   */
  constructor(path, handle) {
    // TODO(vapier): This should really be FIFO, but WASI doesn't define that?
    super(path, WASI.filetype.CHARACTER_DEVICE);
    this.handle_ = handle;
    this.log_ = newBuffer(/* autoack= */ true);
  }

  /**
   * @param {!TypedArray} buf
   * @return {!Promise<!WASI_t.errno|{nwritten: number}>}
   * @override
   */
  write(buf) {
    this.log_.write(buf);
    return this.handle_.write(buf);
  }

  /**
   * @param {!TypedArray} buf
   * @param {number|bigint} offset
   * @return {!Promise<!WASI_t.errno|{nwritten: number}>}
   * @override
   */
  async pwrite(buf, offset) {
    return WASI.errno.ESPIPE;
  }

  /**
   * @param {number} length
   * @return {!Promise<!WASI_t.errno|
   *                   {buf: !Uint8Array, nread: number}|
   *                   {buf: !Uint8Array}|
   *                   {nread: number}>}
   * @override
   */
  async read(length) {
    return WASI.errno.ESPIPE;
  }

  /**
   * @param {number} length
   * @param {number|bigint} offset
   * @return {!Promise<!WASI_t.errno|
   *                   {buf: !Uint8Array, nread: number}|
   *                   {buf: !Uint8Array}|
   *                   {nread: number}>}
   * @override
   */
  async pread(length, offset) {
    return WASI.errno.ESPIPE;
  }

  /**
   * @return {!WASI_t.errno|{offset: (number|bigint)}}
   * @override
   */
  tell() {
    return WASI.errno.ESPIPE;
  }
}

/**
 * A WASM program.
 */
export class WasmSubproc {
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
   *   secureInput: function(string, number, boolean),
   *   captureStdout: (boolean|undefined),
   * }} opts
   */
  constructor({executable, argv, environ, terminal, trace, authAgent,
               authAgentAppID, relay, secureInput, captureStdout}) {
    this.executable_ = executable;
    this.argv_ = argv;
    this.environ_ = environ;
    this.terminal_ = terminal;
    this.trace_ = trace === undefined ? false : trace;
    this.authAgent_ = authAgent;
    this.authAgentAppID_ = authAgentAppID;
    this.relay_ = relay;
    this.secureInput_ = secureInput;
    this.process_ = null;
    this.captureStdout_ = captureStdout;
  }

  /**
   * @return {!Promise<void>} When the process has been initialized.
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
      // NB: Max buffer to support in a single syscall; OpenSSH is known to call
      // read() on 256KiB data, so use a bit bigger for locking overhead.
      sabSize: 257 * 1024,
    };
    await settings.handler.init();

    await this.initHandler_(settings.handler);

    this.process_ = new WasshProcess.Background(
        sanitizeScriptUrl(`../wassh/js/worker.js?trace=${this.trace_}`),
        settings);
  }

  /**
   * @param {!Object} handler The syscall handler.
   */
  async initHandler_(handler) {
    if (this.captureStdout_) {
      // Wrap stdout in a logger which will save the output & pass it thru.
      const origStdout = handler.vfs.fds_.get(1);
      const logStdout = new LogPipeWriteHandle('/dev/stdout/log', origStdout);
      handler.vfs.fds_.set(1, logStdout);
    }
  }

  /**
   * Run the program.
   *
   * @return {!Promise<number>} The exit status of the program.
   */
  async run() {
    return this.process_.run();
  }

  /**
   * Shutdown the program.
   */
  terminate() {
    // TODO(vapier): Should close all streams upon exit.
    this.process_.terminate();
    this.process_ = null;
    // TODO(vapier): This should be automatic in the process termination.
    cleanupChromeSockets();
  }

  /**
   * Write data to the process.
   *
   * @param {number} fd The file handle to write to.
   * @param {!ArrayBuffer} data The content to write.
   */
  async writeTo(fd, data) {
    const ret = await this.process_.writeTo(fd, data);
    if (typeof ret === 'number') {
      console.error(`Unable to write to fd ${fd}: ${ret}`);
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
    return this.relay_.openSocket(address, port);
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

    // This path convention matches the init() function.
    if (address.startsWith('/AF_UNIX/agent/')) {
      if (this.authAgent_) {
        args = {authAgent: this.authAgent_};
        stream = new SshAgentStream(args);
      } else {
        args = {authAgentAppID: address.split('/')[3]};
        stream = new SshAgentRelayStream();
      }
    }

    if (stream) {
      // We handle this above, but closure compiler can't.
      lib.notUndefined(args);
      await stream.open(args);
    }

    return stream;
  }
}
