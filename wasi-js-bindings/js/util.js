// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Random utility functions with no real home.
 */

import * as ERRNO from './wasi/errno.js';

// eslint-disable-next-line jsdoc/require-returns-check
/**
 * Generator to return all properties on an object.
 *
 * @param {?Object} obj The object whose names to enumerate.
 * @return {!Iterable<string>} The property names.
 */
export function* getAllPropertyNames(obj) {
  while (obj) {
    const keys = Object.getOwnPropertyNames(obj);
    for (let i = 0; i < keys.length; ++i) {
      yield keys[i];
    }
    obj = Object.getPrototypeOf(obj);
  }
}

/**
 * Status of an exited process.
 */
export class CompletedProcessError extends Error {
  /**
   * @param {{
   *   status: (number|undefined),
   *   signal: (number|undefined),
   *   message: (string|undefined),
   * }} param1
   */
  constructor({status, signal, message}) {
    super();
    this.status = status;
    this.signal = signal;
    this.message_ = message;
    this.message = this.toString();
  }

  /**
   * Convert object to a human readable string.
   *
   * @override
   * @return {string}
   */
  toString() {
    let ret;
    if (this.status !== undefined) {
      ret = `Process called exit(${this.status})`;
    } else if (this.signal !== undefined) {
      ret = `Process exited due to signal ${this.signal}`;
    } else {
      ret = 'Process exited for unknown reasons';
    }
    if (this.message_) {
      ret += `: ${this.message_}`;
    }
    return ret;
  }
}

/**
 * Exception when a documented API is used incorrectly.
 */
export class ApiViolation extends Error {}

/**
 * Turn error number into symbolic constant.
 *
 * @param {number} errno The error number.
 * @return {string} The symbolic constant (e.g. EINVAL).
 */
export function strerror(errno) {
  for (const [key, val] of Object.entries(ERRNO)) {
    if (key[0] == 'E' && val == errno) {
      return key;
    }
  }
  return `E???[${errno}]`;
}
