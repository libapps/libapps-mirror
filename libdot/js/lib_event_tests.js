// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Event test suite.
 * @suppress {missingProperties} https://github.com/google/closure-compiler/issues/946
 */

import {lib} from '../index.js';

describe('lib_event_tests.js', () => {

it('complete', () => {
  const event = new lib.Event();

  // Post events w/no listeners.
  event.emit();
  event.emit(1);
  event.emit('a', 'b');

  // Add listener.
  const events1 = [];
  const callback1 = (...args) => { events1.push(args); };
  event.addListener(callback1);

  // Post more events.
  event.emit();
  event.emit(2);
  event.emit('c', 'd');
  assert.deepStrictEqual(events1, [[], [2], ['c', 'd']]);

  // Add another listener.
  const events2 = [];
  const callback2 = (...args) => { events2.push(args); };
  event.addListener(callback2);

  // Post more events.
  event.emit(null);
  event.emit([1, 2]);
  assert.deepStrictEqual(events1, [[], [2], ['c', 'd'], [null], [[1, 2]]]);
  assert.deepStrictEqual(events2, [[null], [[1, 2]]]);

  // Remove the first listener.
  event.removeListener(callback1);

  // Post more events.
  event.emit(undefined);
  assert.deepStrictEqual(events1, [[], [2], ['c', 'd'], [null], [[1, 2]]]);
  assert.deepStrictEqual(events2, [[null], [[1, 2]], [undefined]]);

  // Remove the second listener.
  event.removeListener(callback2);

  // Post more events.
  event.emit('final');
  assert.deepStrictEqual(events1, [[], [2], ['c', 'd'], [null], [[1, 2]]]);
  assert.deepStrictEqual(events2, [[null], [[1, 2]], [undefined]]);
});

/**
 * Verify unknown listeners are ignored when removing.
 */
it('remove unknown listeners', () => {
  const event = new lib.Event();
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
