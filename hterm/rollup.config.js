// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Bundle up for release.
 */

import image from '@rollup/plugin-image';
import terser from '@rollup/plugin-terser';
import url from '@rollup/plugin-url';
import concat from 'rollup-plugin-concat';
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

  // Code that hterm depends on from outside of the hterm/ directory.
  {
    input: 'dist/.concat.hterm_deps.js',
    output: {
      ...output,
      file: 'dist/js/hterm_deps.js',
    },
    plugins: [
      concat({
        groupedFiles: [
          {
            files: ['../libdot/dist/js/libdot.js'],
            outputFile: 'dist/.concat.hterm_deps.js',
          },
        ],
      }),
      ...plugins,
    ],
  },

  // Main lib.
  {
    input: 'dist/.concat.hterm.js',
    output: {
      ...output,
      file: 'dist/js/hterm.js',
    },
    plugins: [
      concat({
        groupedFiles: [
          {
            files: [
              'js/hterm.js',
              'js/hterm_accessibility_reader.js',
              'js/hterm_contextmenu.js',
              'js/hterm_find_bar.js',
              'js/hterm_frame.js',
              'js/hterm_keyboard.js',
              'js/hterm_keyboard_bindings.js',
              'js/hterm_keyboard_keymap.js',
              'js/hterm_keyboard_keypattern.js',
              'js/hterm_notifications.js',
              'js/hterm_options.js',
              'js/hterm_parser.js',
              'js/hterm_parser_identifiers.js',
              'js/hterm_preference_manager.js',
              'js/hterm_pubsub.js',
              'js/hterm_screen.js',
              'js/hterm_scrollport.js',
              'js/hterm_terminal.js',
              'js/hterm_terminal_io.js',
              'js/hterm_text_attributes.js',
              'js/hterm_vt.js',
              'js/hterm_vt_character_map.js',
              'third_party/intl-segmenter/intl-segmenter.js',
              'third_party/wcwidth/wc.js',
              'dist/js/hterm_resources.js',
            ],
            outputFile: 'dist/.concat.hterm.js',
          },
        ],
      }),
      ...plugins,
    ],
  },

  // Combo file.  Most apps want to use this.
  {
    input: 'dist/.concat.hterm_all.js',
    output: {
      ...output,
      file: 'dist/js/hterm_all.js',
    },
    plugins: [
      concat({
        groupedFiles: [
          {
            files: [
              'dist/js/hterm_deps.js',
              'dist/js/hterm.js',
            ],
            outputFile: 'dist/.concat.hterm_all.js',
          },
        ],
      }),
      ...plugins,
    ],
  },
];

if (process.env.LIBAPPS_DEPS_ONLY !== undefined) {
  targets = targets.slice(0, 1);
}

export default [...targets];
