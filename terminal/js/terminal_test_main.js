// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test framework setup when run inside the browser.
 */

import * as libTest from '../../libdot/js/lib_test_util.js';

import {init} from './terminal_common.js';

libTest.main({
  // TODO(lxj@google.com): Move preference manager into a module such that it is
  // no longer a global variable.
  globals: [
    'PreferenceManager',
    'preferenceManager',
    'storage',
  ],
  base: '../../terminal/js',
  files: [
    // This needs to be the first test file. Otherwise, the test
    // "installEscKHandler()" is not able to test the case before installing the
    // handler. See `XtermInternal.installEscKHandler()`.
    'terminal_xterm_internal_tests.js',

    // go/keep-sorted start
    'terminal_common_tests.js',
    'terminal_dialog_tests.js',
    'terminal_dropdown_tests.js',
    'terminal_emulator_tests.js',
    'terminal_file_editor_tests.js',
    'terminal_find_bar_tests.js',
    'terminal_home_app_tests.js',
    'terminal_info_tests.js',
    'terminal_linux_dialog_tests.js',
    'terminal_profiles_tests.js',
    'terminal_settings_ansi_colors_tests.js',
    'terminal_settings_app_tests.js',
    'terminal_settings_background_image_tests.js',
    'terminal_settings_category_selector_tests.js',
    'terminal_settings_checkbox_tests.js',
    'terminal_settings_colorpicker_tests.js',
    'terminal_settings_fonts_tests.js',
    'terminal_settings_hue_slider_tests.js',
    'terminal_settings_profile_header_tests.js',
    'terminal_settings_profile_item_tests.js',
    'terminal_settings_row_tests.js',
    'terminal_settings_saturation_value_picker_tests.js',
    'terminal_settings_scrollback_limit_tests.js',
    'terminal_settings_theme_tests.js',
    'terminal_settings_transparency_slider_tests.js',
    'terminal_slider_tests.js',
    'terminal_ssh_dialog_tests.js',
    'terminal_tests.js',
    'terminal_textfield_tests.js',
    'terminal_tmux_tests.js',
    'tmux_tests.js',
    // go/keep-sorted end
  ],
});

/**
 * Setup that runs before all test suites.
 */
before(async function() {
  await init();
});

/**
 * @suppress {constantProperty} Allow tests in all browsers.
 */
window.chrome = window.chrome || {};
