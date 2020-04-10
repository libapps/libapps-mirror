// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Utility functions test suite.
 */

describe('lib_f_tests.js', () => {

it('replaceVars', () => {
  let input;

  input = 'l/i%20b d&ot+';
  assert.equal(
    lib.f.replaceVars('blah %encodeURI(name) blah', {name: input}),
    'blah ' + encodeURI(input) + ' blah');

  input = 'l/i%20b d&ot+';
  assert.equal(
    lib.f.replaceVars('blah %encodeURIComponent(name) blah', {name: input}),
    'blah ' + encodeURIComponent(input) + ' blah');

  input = '<lib&dot> text';
  assert.equal(
    lib.f.replaceVars('blah %escapeHTML(name) blah', {name: input}),
    'blah &lt;lib&amp;dot&gt; text blah');
});

it('getURL', () => {
  if (lib.f.getURL.chromeSupported()) {
    assert.equal(lib.f.getURL('foo'), chrome.runtime.getURL('foo'));
  } else {
    // We don't have a chrome.runtime and such, so just test pass through.
    assert.equal(lib.f.getURL('foo'), 'foo');
  }
});

it('clamp', () => {
  assert.equal(lib.f.clamp(0, -1, 1), 0);
  assert.equal(lib.f.clamp(0, 10, 100), 10);
  assert.equal(lib.f.clamp(0, -100, -3), -3);
});

it('zpad', () => {
  assert.equal(lib.f.zpad(0, 0), '0');
  assert.equal(lib.f.zpad(0, 5), '00000');
  assert.equal(lib.f.zpad(123, 5), '00123');
});

/**
 * Check basic getStack behavior.
 */
it('getStack', () => {
  // Set up some actual functions to check.
  let stack;
  const f1 = (...args) => lib.f.getStack(...args);
  const f2 = (...args) => f1(...args);
  const f3 = (...args) => f2(...args);

  // First an empty result test.
  assert.deepStrictEqual([], f3(100000));
  assert.deepStrictEqual([], f3(undefined, 0));
  assert.equal(1, f3(0, 1).length);

  stack = f3();
  assert.notEqual(stack[0].indexOf('f1'), -1);
  assert.notEqual(stack[1].indexOf('f2'), -1);
  assert.notEqual(stack[2].indexOf('f3'), -1);
  assert.isAbove(stack.length, 3);

  stack = f3(1);
  assert.notEqual(stack[0].indexOf('f2'), -1);
  assert.notEqual(stack[1].indexOf('f3'), -1);
  assert.isAbove(stack.length, 2);

  stack = f3(2, 1);
  assert.equal(stack.length, 1);
  assert.notEqual(stack[0].indexOf('f3'), -1);
});

it('randomInt', () => {
  // How many extra samples to grab.  It's random, so hope for the best.
  const maxSamples = 1000;
  let ret;
  const seen = [];
  const min = 0;
  const max = 10;

  for (let i = 0; i < maxSamples; ++i) {
    ret = lib.f.randomInt(min, max);
    assert.isTrue(ret >= min && ret <= max);
    seen[ret] = 1;
  }

  assert.equal((max - min + 1), seen.reduce((sum, value) => sum + value));
});

/**
 * Simple smoke test.  Relies on a lot on current runtime as we don't mock
 * out all the runtime APIs that this code uses.
 */
it('getOs', () => {
  return lib.f.getOs().then((os) => {
    assert.isAbove(os.length, 0);
  });
});

/**
 * Simple smoke test.
 */
it('getChromeMilestone', () => {
  const milestone = lib.f.getChromeMilestone();
  if (window.chrome) {
    assert.isAbove(milestone, 30);
  } else {
    assert.isNaN(milestone);
  }
});

/**
 * Simple smoke test.  It gets set by async funcs, so it's not trivial to
 * trigger and then test for it.
 */
it('lastError', () => {
  // Initially there should be no errors.
  assert.isNull(lib.f.lastError());
});

/**
 * Simple smoke test.  The runtime seems to block any attempts to open windows
 * (probably because the code wasn't triggered by user interaction), so we can't
 * actually test too much behavior here :/.
 */
it('openWindow', () => {
  // Can't open windows in node environments.
  if (typeof process != 'undefined') {
    return;
  }

  const win = lib.f.openWindow();
  if (win !== null) {
    assert.isNull(win.opener);
    win.close();
  }
});

});
