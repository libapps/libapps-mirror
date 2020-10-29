// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Event test suite.
 * @suppress {missingProperties} https://github.com/google/closure-compiler/issues/946
 */

describe('lib_event_tests.js', () => {

it('complete', () => {
  const event = lib.Event();

  // Post events w/no listeners.
  event();
  event(1);
  event('a', 'b');

  // Add listener.
  const events1 = [];
  const callback1 = (...args) => { events1.push(args); };
  event.addListener(callback1);

  // Post more events.
  event();
  event(2);
  event('c', 'd');
  assert.deepStrictEqual(events1, [[], [2], ['c', 'd']]);

  // Add another listener.
  const events2 = [];
  const callback2 = (...args) => { events2.push(args); };
  event.addListener(callback2);

  // Post more events.
  event(null);
  event([1, 2]);
  assert.deepStrictEqual(events1, [[], [2], ['c', 'd'], [null], [[1, 2]]]);
  assert.deepStrictEqual(events2, [[null], [[1, 2]]]);

  // Remove the first listener.
  event.removeListener(callback1);

  // Post more events.
  event(undefined);
  assert.deepStrictEqual(events1, [[], [2], ['c', 'd'], [null], [[1, 2]]]);
  assert.deepStrictEqual(events2, [[null], [[1, 2]], [undefined]]);

  // Remove the second listener.
  event.removeListener(callback2);

  // Post more events.
  event('final');
  assert.deepStrictEqual(events1, [[], [2], ['c', 'd'], [null], [[1, 2]]]);
  assert.deepStrictEqual(events2, [[null], [[1, 2]], [undefined]]);
});

/**
 * Verify unknown listeners are ignored when removing.
 */
it('remove unknown listeners', () => {
  const event = lib.Event();
  assert.deepEqual(event.observers, []);
  event.removeListener(() => {});
  assert.deepEqual(event.observers, []);
  const callback = () => {};
  event.addListener(callback);
  assert.deepEqual(event.observers, [callback]);
  event.removeListener(() => {});
  assert.deepEqual(event.observers, [callback]);
  event.removeListener(callback);
  assert.deepEqual(event.observers, []);
});

});
