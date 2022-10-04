// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Resolve ES6 import statements in node dependencies used by
 * nassh and package them into a single, minified ES6 module.
 */

import {terser} from 'rollup-plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const plugins = [
  resolve({
    mainFields: ['module', 'jsnext:main'],
    preferBuiltins: false
  }),
  terser(),
  commonjs(),
];

/**
 * Helper for building up deps.
 *
 * @param {string} name
 * @return {!Object}
 */
function nassh_dep(name) {
  return {
    input: `js/deps_${name}.shim.js`,
    output: {
      file: `js/deps_${name}.rollup.js`,
      format: 'es',
    },
    plugins: plugins,
  };
}

export default [
  // TODO(vapier): Kill this off.
  {
    input: 'js/nassh_deps_rollup_shim.js',
    output: {
      file: 'js/nassh_deps.rollup.js',
      format: 'es',
    },
    plugins: plugins,
  },
  nassh_dep('indexeddb-fs'),
  nassh_dep('lit'),
  nassh_dep('pkijs'),
  nassh_dep('punycode'),
  nassh_dep('xterm'),
];
