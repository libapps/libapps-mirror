// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Bundle up for release.
 */

import image from '@rollup/plugin-image';
import terser from '@rollup/plugin-terser';
import url from '@rollup/plugin-url';
import gitInfo from 'rollup-plugin-git-info';
import html from 'rollup-plugin-html';
import {string} from 'rollup-plugin-string';

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
      file: 'dist/js/hterm_resources_iife.js',
      format: 'iife',
    },
    plugins: [
      ...plugins,
      // Always run terser on these files as it's all generated anyways.
      terser(),
      gitInfo(),
      html(),
      string({include: "**/*.svg"}),
      image({exclude: "**/*.svg"}),
      url({include: ['**/*.ogg']}),
    ],
  },
  // Resources hacked up so closure-compiler doesn't complain.
  {
    input: 'dist/js/hterm_resources_iife.js',
    output: {
      ...output,
      file: 'dist/js/hterm_resources.js',
      intro: 'lib.resource._=',
    },
  },
];

if (process.env.LIBAPPS_DEPS_ONLY !== undefined) {
  targets = targets.slice(0, 1);
}

export default [...targets];
