// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Common buffer API tests.
 */

import {newBuffer, setDefaultBackend} from './nassh_buffer.js';
import {ScatGatBuffer} from './nassh_buffer_scatgat.js';

describe('nassh_buffer_tests.js', () => {

/**
 * Check creating data packets.
 */
it('new', () => {
  // Default is scatgat.
  let ret = newBuffer();
  assert.instanceOf(ret, ScatGatBuffer);

  // Bad config still works.
  setDefaultBackend('foooooo');
  ret = newBuffer();
  assert.instanceOf(ret, ScatGatBuffer);

  // Restore good state.
  setDefaultBackend('scatgat');
});

});
