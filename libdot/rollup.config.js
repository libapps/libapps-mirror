// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Bundle up for release.
 */

import terser from '@rollup/plugin-terser';
import concat from 'rollup-plugin-concat';
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
      file: 'dist/js/libdot_resources_iife.js',
      format: 'iife',
    },
    plugins: [
      ...plugins,
      // Always run terser on these files as it's all generated anyways.
      terser(),
      gitInfo(),
    ],
  },
  // Resources hacked up so closure-compiler doesn't complain.
  {
    input: 'dist/js/libdot_resources_iife.js',
    output: {
      ...output,
      file: 'dist/js/libdot_resources.js',
      intro: 'lib.resource._=',
    },
  },

  // Main lib.
  {
    input: 'dist/.concat.libdot.js',
    output: {
      ...output,
      file: 'dist/js/libdot.js',
    },
    plugins: [
      concat({
        groupedFiles: [
          {
            files: [
              'js/lib.js',
              'js/lib_polyfill.js',
              'js/lib_codec.js',
              'js/lib_colors.js',
              'js/lib_event.js',
              'js/lib_f.js',
              'js/lib_i18n.js',
              'js/lib_message_manager.js',
              'js/lib_preference_manager.js',
              'js/lib_resource.js',
              'js/lib_storage.js',
              'js/lib_storage_chrome.js',
              'js/lib_storage_local.js',
              'js/lib_storage_memory.js',
              'js/lib_storage_terminal_private.js',
              'dist/js/libdot_resources.js',
            ],
            outputFile: 'dist/.concat.libdot.js',
          },
        ],
      }),
      ...plugins,
    ],
  },

  // Main lib (ES6).
  {
    input: 'dist/js/libdot.js',
    output: {
      ...output,
      file: 'index.js',
      outro: 'export {lib};',
    },
    plugins,
  },
];

if (process.env.LIBAPPS_DEPS_ONLY !== undefined) {
  targets = targets.slice(0, 1);
}

export default [...targets];
