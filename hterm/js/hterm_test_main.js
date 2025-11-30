// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test framework setup when run inside the browser.
 */

import * as libTest from '../../libdot/js/lib_test_util.js';

libTest.main({
  base: '../../hterm/js',
  files: [
    // go/keep-sorted start
    '../third_party/intl-segmenter/intl-segmenter_tests.js',
    '../third_party/wcwidth/wc_tests.js',
    'hterm_accessibility_reader_tests.js',
    'hterm_contextmenu_tests.js',
    'hterm_find_bar_tests.js',
    'hterm_keyboard_keymap_tests.js',
    'hterm_keyboard_tests.js',
    'hterm_notifications_tests.js',
    'hterm_parser_tests.js',
    'hterm_preference_manager_tests.js',
    'hterm_pubsub_tests.js',
    'hterm_screen_tests.js',
    'hterm_scrollport_tests.js',
    'hterm_terminal_io_tests.js',
    'hterm_terminal_tests.js',
    'hterm_tests.js',
    'hterm_text_attributes_tests.js',
    'hterm_vt_canned_tests.js',
    'hterm_vt_character_map_tests.js',
    'hterm_vt_tests.js',
    // go/keep-sorted end
  ],
});
