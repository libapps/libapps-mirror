// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Shim to export resources used by hterm.
 * @suppress {moduleLoad}
 */

import auBell from '../audio/bell.ogg';
import htmlFindBar from '../html/find_bar.html';
import htmlFindScreen from '../html/find_screen.html';
import imgClose from '../images/close.svg';
import imgCopy from '../images/copy.svg';
import icon96 from '../images/icon-96.png';
import imgKeyboardArrowDown from '../images/keyboard_arrow_down.svg';
import imgKeyboardArrowUp from '../images/keyboard_arrow_up.svg';
import {gitCommitHash, gitDate, version} from '../package.json';

export {
  auBell as AU_BELL,
  gitCommitHash as GIT_COMMIT,
  gitDate as GIT_DATE,
  htmlFindBar as HTML_FIND_BAR,
  htmlFindScreen as HTML_FIND_SCREEN,
  imgClose as IMG_CLOSE,
  imgCopy as IMG_COPY,
  imgKeyboardArrowDown as IMG_KEYBOARD_ARROW_DOWN,
  imgKeyboardArrowUp as IMG_KEYBOARD_ARROW_UP,
  icon96 as IMG_ICON_96,
  version as VERSION,
};
