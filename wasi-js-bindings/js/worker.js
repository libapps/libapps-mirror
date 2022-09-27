// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview APIs for background processes running in Web Workers.
 */

import * as Process from './process.js';

/**
 * Base class for creating your own background worker.
 *
 * You most likely only want to implement newProcess.
 *
 * @unrestricted https://github.com/google/closure-compiler/issues/1737
 */
export class Base {
  /**
   * @param {!Worker} worker The WebWorker to bind to.
   * @param {{
   *   debug: (boolean|undefined),
   * }=} options
   */
  constructor(worker, {debug} = {}) {
    this.worker = worker;
    this.enableDebug_ = debug;
  }

  /**
   * Create a new process!
   *
   * @param {string} executable The path to the WASM program.
   * @param {!Array<string>} argv The program's command line opts.
   * @param {!Object<string, string>} environ The program's environment.
   * @param {!SharedArrayBuffer=} sab The shared array buffer memory.
   * @param {*=} handler_ids
   * @return {!Process.Foreground} The new process.
   */
  newProcess(executable, argv, environ, sab = undefined,
             handler_ids = undefined) {
    const sys_handlers = [];
    const sys_entries = [];
    return new Process.Foreground(
        {executable, argv, environ, sys_handlers, sys_entries});
  }

  /**
   * Bind to the worker for handling incoming messages.
   */
  bind() {
    // Save a ref for console debugging.
    globalThis['wassh_worker_'] = this;
    this.worker.addEventListener(
        'message', /** @type {!EventListener} */ (this.onMessage.bind(this)));
  }

  /**
   * Log a debug message.
   *
   * @param {...*} args The message to log.
   */
  debug(...args) {
    if (!this.enableDebug_) {
      return;
    }

    console.debug(...args);
  }

  /**
   * Send an error message.
   *
   * @param {...*} args The message to log.
   */
  postError(...args) {
    this.debug('worker>>> error', args);
    postMessage({name: 'error', argv: args});
  }

  /**
   * Send a normal message.
   *
   * @param {string} name The message identifier.
   * @param {...*} args The message to log.
   */
  postMessage(name, ...args) {
    this.debug(`worker>>> postMessage ${name}`, args);
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
    this.debug('>>>worker onMessage', data);

    const {name, argv} = data;

    const method = `onMessage_${name}`;
    if (method in this) {
      try {
        await this[method].apply(this, argv);
      } catch (e) {
        this.postError(`Error while handling ${name}: ${e}`, e);
      }
    } else {
      this.postError(`Unknown message "${name}"`);
    }
  }

  /**
   * Create & run the program.
   *
   * @param {string} executable The path to the WASM program.
   * @param {!Array<string>} argv The program's command line opts.
   * @param {!Object<string, string>} environ The program's environment.
   * @param {!SharedArrayBuffer} sab The shared array buffer memory.
   * @param {...*} handlers
   */
  async onMessage_run(executable, argv, environ, sab, handlers) {
    const proc = this.newProcess(executable, argv, environ, sab, handlers);
    const ret = await proc.run();
    this.postMessage('exit', ret);
  }
}
