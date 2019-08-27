// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Test framework setup when run on the command line via node.
 */

// Add a global shortcut to the assert API.
global['assert'] = require('chai').assert;

// Stub out the window object as much as we need.
const jsdom = require('jsdom');
global['window'] = new jsdom.JSDOM().window;

// Node doesn't support this (yet?).
require('../third_party/intl-segmenter/intl-segmenter.js');

// Polyfill until jsdom supports this.
// https://github.com/jsdom/jsdom/issues/2524
assert.isUndefined(window.TextEncoder);
assert.isUndefined(window.TextDecoder);
require('../third_party/fast-text-encoding/text.js');

// Polyfill until jsdom supports this.
// https://github.com/jsdom/jsdom/issues/1612
assert.isUndefined(window.crypto);
const cryptoStorage = {};
window.crypto = {
  // Not exactly random, but good enough for testing.
  getRandomValues: (buf) => buf.fill(0xa5),
  subtle: {
    // These encrypt/decrypt funcs only work when called together.
    // Which is good enough for our tests, but not in general.
    generateKey: (algorithm, extractable, keyUsages) => {
      return Promise.resolve({
        algorithm: algorithm,
        extractable: extractable,
        type: 'secret',
        usages: keyUsages,
      });
    },
    decrypt: (algorithm, key, data) => {
      return Promise.resolve(cryptoStorage[data]);
    },
    encrypt: (algorithm, key, data) => {
      data = new Uint8Array(data).slice();
      const str = data.join('%');
      const enc = `ENC:${str}`;
      cryptoStorage[enc] = data;
      return Promise.resolve(enc);
    },
  },
};

// Stuff various APIs into the global scope that are attached to window.
// We have code that uses these APIs directly w/out the "window." scope.
['Blob', 'FileReader', 'Intl', 'navigator'].forEach((method) => {
  global[method] = window[method];
});

// Finally, our project.
global['lib'] = require('./libdot.js');
