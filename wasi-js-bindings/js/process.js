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
 *
 * @extends {Process}
 */
class Base {
  /**
   * @param {{
   *   executable: string,
   *   argv: !Array<string>,
   *   environ: !Object<string, string>,
   * }} param1
   */
  constructor({executable, argv, environ}) {
    this.executable = executable;
    this.argv = argv;
    this.environ = environ;
  }

  /** @override */
  debug(...args) {
    console.log(...args);
  }

  /** @override */
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
  /**
   * @param {{
   *   executable: string,
   *   argv: !Array<string>,
   *   environ: !Object<string, string>,
   *   sys_handlers: !Array<!SyscallHandler>,
   *   sys_entries: !Array<!SyscallEntry>,
   * }} param1
   */
  constructor({executable, argv, environ, sys_handlers, sys_entries}) {
    super({executable, argv, environ});
    this.sys_handlers = sys_handlers;
    this.sys_entries = sys_entries;
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
   *
   * @return {!Object}
   */
  getImports_() {
    return this.sys_entries.reduce((ret, sys_entry) => {
      return Object.assign(ret, sys_entry.getImports());
    }, {});
  }

  /** @override */
  getMem(base, end = undefined) {
    return new Uint8Array(this.instance_.exports.memory.buffer)
        .subarray(base, end);
  }

  /**
   * @override
   * @suppress {checkTypes} WasiView$$module$js$dataview naming confusion.
   */
  getView(base, length = undefined) {
    return new WasiView(this.instance_.exports.memory.buffer, base, length);
  }
}

/**
 * A process that runs in a web worker.
 *
 * This will take care of creating the web worker, managing its communication,
 * and its lifecycle.  You need to provide the script that runs in the new
 * worker and implements the worker.js APIs.
 *
 * @unrestricted https://github.com/google/closure-compiler/issues/1737
 */
export class Background extends Base {
  /**
   * @param {string} workerUri
   * @param {{
   *   executable: string,
   *   argv: !Array<string>,
   *   environ: !Object<string, string>,
   *   handler: !SyscallHandler,
   * }} param1
   */
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
    this.terminate({message: e.toString()});
  }

  /**
   * @param {string} name
   * @param {number|string|!Object} args Arguments that can be serialized.
   */
  postMessage(name, ...args) {
    this.debug(`main>>> postMessage ${name}`, args);
    this.worker.postMessage({name, argv: args});
  }

  /**
   * Handle an incoming messsage.
   *
   * The message must have a registered handler (see onMessage_*).
   *
   * @param {!MessageEvent} e The message sent to us.
   */
  async onMessage(e) {
    /**
     * @type {{
     *   name: string,
     *   argv: !Array<*>,
     * }}
     */
    const data = e.data;
    this.debug('>>>main onMessage', data);

    const {name, argv} = data;

    const method = `onMessage_${name}`;
    if (method in this) {
      try {
        await this[method].apply(this, argv);
      } catch (e) {
        this.onError(`Error while handling ${name}: ${e}\n${e.stack}`);
      }
    } else {
      this.onError(`Unknown message "${name}"`);
    }
  }

  /**
   * @param {string} syscall
   * @param {!Array<*>} args
   */
  async onMessage_syscall(syscall, ...args) {
    const method = `handle_${syscall}`;
    let ret = WASI.errno.ENOSYS;
    if (method in this.handler) {
      ret = await this.handler[method].apply(this.handler, args);
      if (typeof ret !== 'number') {
        this.lock.setData(ret);
        ret = -1;
      }
    }
    this.lock.setRetcode(ret);
    this.lock.unlock();
  }

  /**
   * @param {number} status
   */
  onMessage_exit(status) {
    this.terminate(new util.CompletedProcessError({status}));
  }

  /**
   * @param {number} signal
   */
  onMessage_signal(signal) {
    this.terminate(new util.CompletedProcessError({signal}));
  }

  onMessage_error(message) {
    this.logError('terminating process due to worker error:', message);
    this.terminate(new util.CompletedProcessError({message}));
  }

  terminate(reason) {
    this.resolve_(reason);
    this.worker.terminate();
  }

  async run() {
    const w = new Worker(this.workerUri, {type: 'module'});
    this.worker = w;
    w.addEventListener(
        'message', /** @type {!EventListener} */ (this.onMessage.bind(this)));
    w.addEventListener('messageerror', this.onMessageError.bind(this));
    w.addEventListener('error', this.onError.bind(this));
    this.postMessage('run', this.executable, this.argv, this.environ, this.sab,
                     this.handler.getHandlers_());

    // Return a promise that resolves when we terminate.
    return new Promise((resolve) => {
      this.resolve_ = resolve;
    });
  }
}
