// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Common buffer API tests.
 */

/**
 * Helper class for inspecting buffer internals.
 *
 * @abstract
 */
nassh.buffer.Inspector = class {
  /**
   * @param {!nassh.buffer.Interface} buffer The buffer to inspect.
   */
  constructor(buffer) {
    this.buffer = buffer;
  }

  /**
   * How many bytes not yet acked.
   *
   * @abstract
   * @return {number}
   */
  getUnackedCount() {}
};

/**
 * Testsuite for the generic buffer API.
 *
 * Each implementation should call this to verify functionality.
 *
 * @param {string} backend The name of the backend to instantiate.
 * @param {!typeof nassh.buffer.Inspector} inspectClass Class for inspecting the
 *     buffer internals while testing.
 * @suppress {checkTypes} Closure can't figure out abstract class.
 */
nassh.buffer.ApiTest = function(backend, inspectClass) {

/**
 * Check behavior of empty buffers.
 */
it('buffer-empty', () => {
  nassh.buffer.backend = backend;
  const buffer = nassh.buffer.new();

  // No data available.
  assert.equal(0, buffer.getUnreadCount());
  // Read data that doesn't exist.
  const data = buffer.read(100);
  // The buffer should be empty.
  assert.equal(0, data.length);
  assert.deepStrictEqual(new Uint8Array(0), data);
  // Internal length should be still be zero.
  assert.equal(0, buffer.getUnreadCount());
  // Acking data that doesn't exist shouldn't confuse it.
  buffer.ack(10);
  assert.equal(0, buffer.getUnreadCount());
});

/**
 * Check autoacking behavior.
 */
it('buffer-autoack', () => {
  nassh.buffer.backend = backend;
  const buffer = nassh.buffer.new(/* autoack= */ true);
  const inspector = new inspectClass(buffer);

  // Write some data to the buffer.
  buffer.write(new Uint8Array([1, 2]));
  buffer.write(new Uint8Array([3]));
  // Make sure our counters are correct.
  assert.equal(3, buffer.getUnreadCount());
  assert.equal(3, inspector.getUnackedCount());

  // Read out a byte and check the counters.
  let data = buffer.read(1);
  assert.deepStrictEqual(new Uint8Array([1]), data);
  assert.equal(2, buffer.getUnreadCount());
  assert.equal(2, inspector.getUnackedCount());

  // Read out the rest of the data and check the counters.
  data = buffer.read(2);
  assert.deepStrictEqual(new Uint8Array([2, 3]), data);
  assert.equal(0, buffer.getUnreadCount());
  assert.equal(0, inspector.getUnackedCount());
});

/**
 * Check manual acking behavior.
 */
it('buffer-manual-ack', () => {
  nassh.buffer.backend = backend;
  const buffer = nassh.buffer.new();
  const inspector = new inspectClass(buffer);

  // Write some data to the buffer.
  buffer.write(new Uint8Array([5, 6, 7]));
  assert.equal(3, buffer.getUnreadCount());

  // Read it out and verify the ack counts.
  buffer.read(1);
  assert.equal(2, buffer.getUnreadCount());
  assert.equal(3, inspector.getUnackedCount());

  // Read out the rest of the data and check the counters.
  buffer.read(2);
  assert.equal(0, buffer.getUnreadCount());
  assert.equal(3, inspector.getUnackedCount());

  // Check ack handling.
  buffer.ack(1);
  assert.equal(2, inspector.getUnackedCount());
  buffer.ack(2);
  assert.equal(0, inspector.getUnackedCount());
});

/**
 * Check automatic buffer growing.
 */
it('buffer-grow', () => {
  nassh.buffer.backend = backend;
  const buffer = nassh.buffer.new();
  const inspector = new inspectClass(buffer);
  const basesize = 1024;

  // Fill the buffer.
  buffer.write(new Uint8Array(basesize).fill(10));
  assert.equal(basesize, buffer.getUnreadCount());

  // Add some more data and check the growth.
  buffer.write(new Uint8Array([1, 2, 3]));
  assert.equal(basesize + 3, buffer.getUnreadCount());

  // Read out most data to verify buffer doesn't move.
  assert.deepStrictEqual(new Uint8Array(basesize).fill(10),
                         buffer.read(basesize));
  assert.equal(3, buffer.getUnreadCount());

  // Write some more data to check more growth.
  buffer.write(new Uint8Array(1024).fill(20));
  assert.equal(1027, buffer.getUnreadCount());

  // Read out all the data.
  assert.deepStrictEqual(new Uint8Array([1, 2, 3]), buffer.read(3));
  assert.deepStrictEqual(new Uint8Array(1024).fill(20), buffer.read(1024));

  // Counters shouldn't change even as we ack.
  assert.equal(0, buffer.getUnreadCount());
  assert.equal(basesize + 1027, inspector.getUnackedCount());
  buffer.ack(basesize + 1027);
  assert.equal(0, inspector.getUnackedCount());
});

};

describe('nassh_buffer_tests.js', () => {

/**
 * Check creating data packets.
 */
it('new', () => {
  // Default is concat.
  let ret = nassh.buffer.new();
  assert.isTrue(ret instanceof nassh.buffer.Concat);

  // Bad config still works.
  nassh.buffer.backend = 'foooooo';
  ret = nassh.buffer.new();
  assert.isTrue(ret instanceof nassh.buffer.Concat);
});

});
