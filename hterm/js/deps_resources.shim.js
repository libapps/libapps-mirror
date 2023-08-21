// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Shim to export resources used by hterm.
 * @suppress {moduleLoad}
 */

// NB: This path is relative to the dist/js/ output dir.
// All other paths in this file are relative to this source file.
import {lib} from '../../../libdot/index.js';

import auBell from '../audio/bell.ogg';
import htmlFindBar from '../html/find_bar.html';
import htmlFindScreen from '../html/find_screen.html';
import imgClose from '../images/close.svg';
import imgCopy from '../images/copy.svg';
import icon96 from '../images/icon-96.png';
import imgKeyboardArrowDown from '../images/keyboard_arrow_down.svg';
import imgKeyboardArrowUp from '../images/keyboard_arrow_up.svg';
import pkg from '../package.json';

/**
 * Add a data uri as a resource.
 *
 * @param {string} name The resource name.
 * @param {string} data The data uri.
 */
function addResource(name, data) {
  // Data should have the form:
  // data:audio/ogg;base64,T2dnUwACAAAAA...
  const ary = data.match(/^data:([^,]+),(.*)$/);
  lib.resource.add(name, ...ary.slice(1));
}

/**
 * Add a html string as a resource.
 *
 * @param {string} name The resource name.
 * @param {string} data The raw html content.
 */
function addHtml(name, data) {
  lib.resource.add(name, 'text/html;utf8', data);
}

/**
 * Add a svg string as a resource.
 *
 * @param {string} name The resource name.
 * @param {string} data The raw svg content.
 */
function addSvg(name, data) {
  lib.resource.add(name, 'image/svg+xml;utf8', data);
}

addResource('hterm/audio/bell', auBell);
addSvg('hterm/images/copy', imgCopy);
addSvg('hterm/images/close', imgClose);
addSvg('hterm/images/keyboard_arrow_down', imgKeyboardArrowDown);
addSvg('hterm/images/keyboard_arrow_up', imgKeyboardArrowUp);
addHtml('hterm/html/find_bar', htmlFindBar);
addHtml('hterm/html/find_screen', htmlFindScreen);
addResource('hterm/images/icon-96', icon96);

lib.resource.add('hterm/concat/date', 'text/plain', pkg.gitDate);
lib.resource.add('hterm/changelog/version', 'text/plain', pkg.version);
lib.resource.add('hterm/changelog/date', 'text/plain', pkg.gitDate);
lib.resource.add('hterm/git/HEAD', 'text/plain', pkg.gitCommitHash);
