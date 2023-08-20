// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Bundle up for release.
 */

import terser from '@rollup/plugin-terser';
import gitInfo from 'rollup-plugin-git-info';

const plugins = [];
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

// The files we'll build.  The deps target must be first.
let targets = [
  // Resources.
  {
    input: 'js/deps_resources.shim.js',
    output: {
      ...output,
      file: 'dist/js/libdot_resources.js',
    },
    plugins: [
      ...plugins,
      // Always run terser on these files as it's all generated anyways.
      terser(),
      gitInfo(),
    ],
  },

  // Main lib.
  {
    input: 'index.js',
    output: {
      ...output,
      file: 'dist/js/libdot.js',
    },
    plugins,
  },
];

if (process.env.LIBAPPS_DEPS_ONLY !== undefined) {
  targets = targets.slice(0, 1);
}

export default [...targets];
