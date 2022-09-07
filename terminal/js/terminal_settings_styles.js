// Copyright 2020 The ChromiumOS Authors
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
    --cr-input-error-color: rgb(217, 48, 37);
    --cr-primary-text-color: rgb(32, 33, 36);
    --cr-secondary-text-color: rgb(95, 99, 104);
    --focus-shadow-color: rgba(26, 115, 232, .4);
    --font: 'Roboto';
    --google-blue-600: rgb(26, 115, 232);
    --google-blue-600-rgb: 26, 115, 232;
    --google-blue-refresh-500-rgb: 66, 133, 244;
    --google-grey-100-rgb: 241, 243, 244;  /* #f1f3f4 */
    --google-grey-100: rgb(var(--google-grey-100-rgb));
    --google-grey-300: rgb(218, 220, 224);
    --google-grey-600-rgb: 128, 134, 139;  /* #80868b */
    --google-grey-600: rgb(var(--google-grey-600-rgb));
  }
`;
