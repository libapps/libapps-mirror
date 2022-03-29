// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Common code for terminal and it settings page.
 *
 * @suppress {moduleLoad}
 */

import {css} from './lit.js';

export const stylesVars = css`
  :host {
    --active-bg: rgb(232, 240, 254);
    --google-blue-600: rgb(26, 115, 232);
    --google-blue-600-rgb: 26, 115, 232;
    --google-blue-refresh-500-rgb: 66, 133, 244;
    --google-grey-300: rgb(218, 220, 224);
    --cr-primary-text-color: rgb(32, 33, 36);
    --cr-secondary-text-color: rgb(95, 99, 104);
    --focus-shadow-color: rgba(26, 115, 232, .4);
    --font: 'Roboto';
  }
`;
