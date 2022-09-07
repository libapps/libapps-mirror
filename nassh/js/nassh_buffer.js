// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Core buffer related logic.
 */

import {ConcatBuffer} from './nassh_buffer_concat.js';
import {BufferInterface} from './nassh_buffer_interface.js';
import {ScatGatBuffer} from './nassh_buffer_scatgat.js';

/**
 * The buffer backend to use.
 */
let defaultBackend = 'scatgat';

/**
 * Set default backend for all buffer users.
 *
 * This allows for runtime experimentation without affecting the defaults.
 *
 * @param {string} backend The new backend to use.
 */
export function setDefaultBackend(backend) {
  defaultBackend = backend;
}

/**
 * Allocates a new buffer and returns it.
 *
 * This respects the dynamic backend selection.
 *
 * @param {*} args
 * @return {!BufferInterface}
 */
export function newBuffer(...args) {
  switch (defaultBackend) {
    case 'concat':
      return new ConcatBuffer(...args);

    default:
      console.warn(`Unknown buffer type '${defaultBackend}'; ` +
                   `using 'scatgat' instead.`);
    case 'scatgat':
      return new ScatGatBuffer(...args);
  }
}
