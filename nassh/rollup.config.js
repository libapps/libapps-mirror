// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Resolve ES6 import statements in node dependencies used by
 * nassh and package them into a single, minified ES6 module.
 */

import {terser} from 'rollup-plugin-terser';
import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'js/nassh_deps_rollup_shim.js',
  output: {
    file: 'js/nassh_deps.rollup.js',
    format: 'es',
  },
  plugins: [
    resolve({
      mainFields: ['module', 'jsnext:main'],
      preferBuiltins: false
    }),
    terser(),
  ],
};
