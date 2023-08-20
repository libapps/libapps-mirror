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
import concat from 'rollup-plugin-concat';

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
  // Local deps libdot & hterm.
  {
    input: 'dist/.deps_local.concat.js',
    output: {
      ...output,
      file: 'js/deps_local.concat.js',
      intro: "import {lib} from '../../libdot/index.js';",
      outro: "export {hterm};",
    },
    plugins: [
      concat({
        groupedFiles: [
          {
            files: [
              '../hterm/dist/js/hterm.js',
            ],
            outputFile: 'dist/.deps_local.concat.js',
          },
        ],
      }),
    ],
  },

  nassh_dep('indexeddb-fs'),
  nassh_dep('lit'),
  nassh_dep('pkijs'),
  nassh_dep('punycode'),
  nassh_dep('resources'),
  nassh_dep('xterm'),
];

if (process.env.LIBAPPS_DEPS_ONLY !== undefined) {
  targets = targets.slice(0, 1);
}

export default [...targets];
