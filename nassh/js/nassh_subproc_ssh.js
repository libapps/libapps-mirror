// Copyright 2025 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Low level SSH program logic.
 * @suppress {moduleLoad}
 * @suppress {checkTypes} FileHandle$$module$wassh$js$vfs naming confusion.
 */

import {
  MemoryFileHandler, StorageFileHandler, WasmSubproc,
} from './nassh_subproc_wasm.js';

import {WASI} from '../../wasi-js-bindings/index.js';

import {FileHandle} from '../wassh/js/vfs.js';

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

  /**
   * @param {!TypedArray} buf
   * @return {!Promise<!WASI_t.errno|{nwritten: number}>}
   * @override
   */
  write(buf) {
    this.client_.writeStreamData(buf);
    return {nwritten: buf.length};
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
   */
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

  /**
   * @param {!TypedArray} buf
   * @return {!Promise<!WASI_t.errno|{nwritten: number}>}
   * @override
   */
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
    const buf = this.data.slice(0, length);
    this.data = this.data.subarray(length);
    return {buf};
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
   */
  tell() {
    return WASI.errno.ESPIPE;
  }
}

/**
 * SSH programs.
 */
export class SshSubproc extends WasmSubproc {
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
   *   isSftp: (boolean|undefined),
   *   sftpClient: (?Object|undefined),
   *   syncStorage: !lib.Storage,
   *   knownHosts: ?string,
   * }} opts
   */
  constructor({executable, argv, environ, terminal, trace, authAgent,
               authAgentAppID, relay, secureInput, captureStdout,
               isSftp, sftpClient, syncStorage, knownHosts}) {
    super({executable, argv, environ, terminal, trace, authAgent,
           authAgentAppID, relay, secureInput, captureStdout});

    this.isSftp_ = isSftp;
    this.sftpClient_ = sftpClient;
    this.knownHosts_ = knownHosts;
    this.syncStorage_ = syncStorage;

    // Tell OpenSSH to use the sftp subsystem instead of an interactive session.
    if (this.isSftp_) {
      this.argv_.push('-s');
      this.argv_.push('sftp');
    }
  }

  /**
   * @param {!Object} handler The syscall handler.
   * @override
   */
  async initHandler_(handler) {
    super.initHandler_(handler);

    const vfs = handler.vfs;
    vfs.addHandler(new StorageFileHandler(
        '/etc/ssh/ssh_config', this.syncStorage_, '/nassh/etc/ssh/ssh_config'));
    vfs.addHandler(new StorageFileHandler(
        '/etc/ssh/ssh_known_hosts', this.syncStorage_,
        '/nassh/etc/ssh/ssh_known_hosts'));
    // The OpenSSH client defaults to reading from both /etc/ssh/ssh_known_hosts
    // and /etc/ssh/ssh_known_hosts2 for the global known hosts. We use the
    // second file to inject host keys provided by enterprise policy.
    vfs.addHandler(new MemoryFileHandler(
        '/etc/ssh/ssh_known_hosts2', this.knownHosts_ ?? ''));

    // If this is an SFTP connection, rebind stdin/stdout to our custom pipes
    // which connect to our JS SFTP client.
    if (this.isSftp_) {
      const stdin = new SftpPipeReadHandle('sftp-in', handler);
      let fd = vfs.openHandle(stdin);
      if (fd != 0) {
        vfs.fds_.dup2(fd, 0);
        vfs.close(fd);
      }

      const stdout = new SftpPipeWriteHandle('sftp-out', this.sftpClient_);
      fd = vfs.openHandle(stdout);
      if (fd != 1) {
        vfs.fds_.dup2(fd, 1);
        vfs.close(fd);
      }
    }
  }
}
