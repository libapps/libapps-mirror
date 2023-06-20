// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Shim for rollup import.
 */

import {Terminal} from 'xterm';
import {CanvasAddon} from 'xterm-addon-canvas';
import {Unicode11Addon} from 'xterm-addon-unicode11';
import {WebglAddon} from 'xterm-addon-webgl';
import {WebLinksAddon} from 'xterm-addon-web-links';
export const xterm = {Terminal, CanvasAddon, Unicode11Addon, WebLinksAddon,
  WebglAddon};
