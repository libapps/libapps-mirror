// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview hterm main library entry point.
 * @suppress {moduleLoad} Don't try and load dist/js/hterm_resources.js.
 */

import * as resources from './dist/js/hterm_resources.js';
import './js/hterm_accessibility_reader.js';
import './js/hterm_contextmenu.js';
import './js/hterm_find_bar.js';
import './js/hterm_keyboard.js';
import './js/hterm_keyboard_bindings.js';
import './js/hterm_keyboard_keymap.js';
import './js/hterm_keyboard_keypattern.js';
import './js/hterm_notifications.js';
import './js/hterm_options.js';
import './js/hterm_parser.js';
import './js/hterm_parser_identifiers.js';
import './js/hterm_preference_manager.js';
import './js/hterm_pubsub.js';
import './js/hterm_screen.js';
import './js/hterm_scrollport.js';
import './js/hterm_terminal.js';
import './js/hterm_terminal_io.js';
import './js/hterm_text_attributes.js';
import './js/hterm_vt.js';
import './js/hterm_vt_character_map.js';
import './third_party/intl-segmenter/intl-segmenter.js';
import './third_party/wcwidth/wc.js';
import {hterm} from './js/hterm.js';
export {hterm};

hterm.VERSION = resources.VERSION;
hterm.resources = resources;
