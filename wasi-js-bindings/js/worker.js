// Copyright 2020 The Chromium OS Authors. All rights reserved.
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
 */
export class Base {
  constructor(worker) {
    this.worker = worker;
  }

  /**
   * Create a new process!
   */
  newProcess(executable, argv, environ) {
    return new Process.Foreground({executable, argv, environ});
  }

  /**
   * Bind to the worker for handling incoming messages.
   */
  bind() {
    // Save a ref for console debugging.
    globalThis['wassh_worker_'] = this;
    this.worker.addEventListener('message', this.onMessage.bind(this));
  }

  /**
   * Log a debug message.
   */
  debug(...args) {
    console.debug(...args);
  }

  /**
   * Send an error message.
   */
  postError(...args) {
    this.debug('worker>>> error', args);
    postMessage({name: 'error', argv: args});
  }

  /**
   * Send a normal message.
   *
   * @param {string} name The message identifier.
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
   * @param {MessageEvent} e The message sent to us.
   */
  async onMessage(e) {
    this.debug('>>>worker onMessage', e.data);

    const data = e.data;
    const {name, argv} = data;

    const method = `onMessage_${name}`;
    if (method in this) {
      try {
        await this[method].apply(this, argv);
      } catch (e) {
        this.postError(e); //`Error while handling ${name}: ${e}`, e);
      }
    } else {
      this.postError(`Unknown message "${name}"`);
    }
  }

  /**
   * Create & run the program.
   */
  async onMessage_run(executable, argv, environ, sab, handlers) {
    const proc = this.newProcess(executable, argv, environ, sab, handlers);
    await proc.run();
  }
}
