// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Random utility functions with no real home.
 */

import * as ERRNO from './wasi/errno.js';

/**
 * Generator to return all properties on an object.
 *
 * @param {!Object} obj The object whose names to enumerate.
 * @yield {string} The property names.
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
  constructor({status, signal}) {
    super();
    this.status = status;
    this.signal = signal;
    this.message = this.toString();
  }

  /**
   * Convert object to a human readable string.
   */
  toString() {
    if (this.status !== undefined) {
      return `Process called exit(${this.status})`;
    } else if (this.signal !== undefined) {
      return `Process exited due to signal ${this.signal}`;
    } else {
      return 'Process exited for unknown reasons';
    }
  }
}

export function strerror(errno) {
  for (const [key, val] of Object.entries(ERRNO)) {
    if (key[0] == 'E' && val == errno) {
      return key;
    }
  }
  return `E???[${errno}]`;
}
