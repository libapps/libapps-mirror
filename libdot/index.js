// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview libdot main library entry point.
 * @suppress {moduleLoad} Don't try and load dist/js/libdot_resources.js.
 */

import {lib} from './js/lib.js';
import './js/lib_polyfill.js';
import './js/lib_codec.js';
import './js/lib_colors.js';
import './js/lib_event.js';
import './js/lib_f.js';
import './js/lib_i18n.js';
import './js/lib_message_manager.js';
import './js/lib_preference_manager.js';
import './js/lib_resource.js';
import './js/lib_storage.js';
import './js/lib_storage_chrome.js';
import './js/lib_storage_condenser.js';
import './js/lib_storage_local.js';
import './js/lib_storage_memory.js';
import './js/lib_storage_terminal_private.js';
import * as resources from './dist/js/libdot_resources.js';
export {lib};

lib.VERSION = resources.version;
