// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Resolve ES6 import statements in node dependencies used by
 * nassh and package them into a single, minified ES6 module.
 */

import image from '@rollup/plugin-image';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import yaml from '@rollup/plugin-yaml';

const plugins = [
  resolve({
    mainFields: ['module', 'jsnext:main'],
    preferBuiltins: false
  }),
  terser(),
  commonjs(),
  image(),
  yaml(),
];

// Common output settings.
const output = {
  // This only disables the '__esModule' symbol hack.
  esModule: false,
  format: 'es',
  indent: false,
  preferConst: true,
};

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
      ...output,
      file: `js/deps_${name}.rollup.js`,
    },
    plugins: plugins,
  };
}

let targets = [
  {
    input: '../libdot/index.js',
    output: {
      ...output,
      file: 'dist/libdot.js',
    },
    plugins: plugins,
  },
  {
    input: '../hterm/index.js',
    output: {
      ...output,
      file: 'dist/hterm.js',
    },
    external: [
      '../../../libdot/index.js',
      '../../libdot/index.js',
    ],
    plugins: plugins,
  },

  nassh_dep('indexeddb-fs'),
  nassh_dep('lit'),
  nassh_dep('pkijs'),
  nassh_dep('punycode'),
  nassh_dep('resources'),
  nassh_dep('xterm'),
];

export default [...targets];
