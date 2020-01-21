// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Processes for managing program runtimes.
 */

import {Program} from './program.js';
import {SyscallLock} from './syscall_lock.js';
import {WasiView} from './dataview.js';
import * as util from './util.js';
import * as WASI from './wasi.js';

/**
 * Shared logic between different process types.
 */
class Base {
  constructor({executable, argv, environ}) {
    this.executable = executable;
    this.argv = argv;
    this.environ = environ;
  }

  debug(...args) {
    console.log(...args);
  }

  logError(...args) {
    console.error(...args);
  }
}

/**
 * A process that runs in the current thread synchronously.
 *
 * This will not return until the program finishes running, so use it only with
 * fast/short programs, or when the thread is dedicated to it (e.g. a worker).
 */
export class Foreground extends Base {
  constructor({executable, argv, environ, sys_handlers, sys_entries}) {
    super({executable, argv, environ});
    this.sys_handlers_ = sys_handlers;
    this.sys_entries_ = sys_entries;
    this.instance_ = null;

    sys_handlers.forEach((ele) => ele.setProcess(this));
    sys_entries.forEach((ele) => ele.setProcess(this));
  }

  async run() {
    const program = new Program(this.executable);
    this.instance_ = await program.instantiate(this.getImports_());
    return program.run();
  }

  /**
   * Return an imports object suitable for a new WASM instance.
   */
  getImports_() {
    return this.sys_entries_.reduce((ret, sys_entry) => {
      return Object.assign(ret, sys_entry.getImports());
    }, {});
  }

  /**
   * Get a u8 view into the WASM memory.
   *
   * @param {number} base Starting offset in WASM memory to copy from.
   * @param {number} end End offset in WASM memory.
   * @return {Uint8Array}
   */
  getMem(base, end) {
    return new Uint8Array(this.instance_.exports.memory.buffer)
        .subarray(base, end);
  }

  getView(base, length) {
    return new WasiView(this.instance_.exports.memory.buffer, base, length);
  }
}

/**
 * A process that runs in a web worker.
 *
 * This will take care of creating the web worker, managing its communication,
 * and its lifecycle.  You need to provide the script that runs in the new
 * worker and implements the worker.js APIs.
 */
export class Background extends Base {
  constructor(workerUri, {executable, argv, environ, handler}) {
    super({executable, argv, environ});

    this.resolve_ = null;
    this.workerUri = workerUri;
    this.worker = null;
    this.handler = handler;
    this.sab = new SharedArrayBuffer(64 * 1024);
    this.lock = new SyscallLock(this.sab);

    handler.setProcess(this);
  }

  onMessageError(e) {
    this.logError('>>>main onMessageError', e);
  }

  onError(e) {
    this.logError('terminating process due to runtime error:', e);
    this.terminate();
  }

  postMessage(name, ...args) {
    this.debug(`main>>> postMessage ${name}`, args);
    this.worker.postMessage({name, argv: args});
  }

  async onMessage(e) {
    this.debug('>>>main onMessage', e.data);

    const data = e.data;
    const {name, argv} = data;

    const method = `onMessage_${name}`;
    if (method in this) {
      try {
        await this[method].apply(this, argv);
      } catch (e) {
        this.onError(`Error while handling ${name}: ${e}`);
      }
    } else {
      this.onError(`Unknown message "${name}"`);
    }
  }

  onMessage_error(msg) {
    this.logError('terminating process due to worker error:', msg);
    this.terminate();
  }

  async onMessage_syscall(syscall, ...args) {
    const method = `handle_${syscall}`;
    let ret = WASI.errno.ENOSYS;
    if (method in this.handler) {
      ret = await this.handler[method].apply(this.handler, args);
      if (!Number.isInteger(ret)) {
        this.lock.setData(ret);
        ret = -1;
      }
    }
    this.lock.setRetcode(ret);
    this.lock.unlock();
  }

  onMessage_exit(status) {
    this.terminate(new util.CompletedProcessError({status}));
  }

  onMessage_signal(signal) {
    this.terminate(new util.CompletedProcessError({signal}));
  }

  onMessage_error(msg) {
    this.logError('terminating process due to worker error:', msg);
    this.terminate(new util.CompletedProcessError({msg}));
  }

  terminate(reason) {
    this.resolve_(reason);
    this.worker.terminate();
  }

  async run() {
    const w = new Worker(this.workerUri, {type: 'module'});
    this.worker = w;
    w.addEventListener('message', this.onMessage.bind(this));
    w.addEventListener('messageerror', this.onMessageError.bind(this));
//    w.addEventListener('error', this.onError.bind(this));
    this.postMessage('run', this.executable, this.argv, this.environ, this.sab, this.handler.getHandlers_());

    // Return a promise that resolves when we terminate.
    return new Promise((resolve) => {
      this.resolve_ = resolve;
    });
  }
}
