// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Bundle up for release.
 */

import string from '@bkuri/rollup-plugin-string';
import image from '@rollup/plugin-image';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import url from '@rollup/plugin-url';
import gitInfo from 'rollup-plugin-git-info';

const plugins = [
  resolve({
    mainFields: ['module', 'jsnext:main'],
    preferBuiltins: false
  }),
];

if (process.env.NODE_ENV === 'production') {
  plugins.push(terser());
}

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
function dep(name) {
  return {
    input: `js/deps_${name}.shim.js`,
    output: {
      ...output,
      file: `js/deps_${name}.rollup.js`,
    },
    plugins,
  };
}

// The files we'll build.  The deps target must be first.
let targets = [
  // Resources.
  {
    input: 'js/deps_resources.shim.js',
    output: {
      ...output,
      file: 'dist/js/hterm_resources.js',
    },
    external: [
      '../../../libdot/index.js',
    ],
    plugins: [
      ...plugins,
      // Always run terser on these files as it's all generated anyways.
      terser(),
      gitInfo(),
      string({include: ['**/*.html', '**/*.svg']}),
      image({exclude: "**/*.svg"}),
      url({include: ['**/*.ogg']}),
    ],
  },

  // 3rd party deps.
  dep('punycode'),

  // Main lib.
  {
    input: 'index.js',
    output: {
      ...output,
      file: 'dist/js/hterm.js',
    },
    plugins,
  },
];

if (process.env.LIBAPPS_DEPS_ONLY !== undefined) {
  targets = targets.slice(0, 1);
}

export default [...targets];
