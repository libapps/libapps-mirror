// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Common code for terminal and it settings page.
 *
 * @suppress {moduleLoad}
 */

import {css} from './lit_element.js';

export const stylesVars = css`
  :host {
    --google-blue-600: rgb(26, 115, 232);
    --google-blue-600-rgb: 26, 115, 232;
    --google-blue-refresh-500-rgb: 66, 133, 244;
    --font: 'Roboto';
  }
`;

export const stylesButtonContainer = css`
  .button-container {
    display: flex;
    justify-content: flex-end;
    padding-bottom: 16px;
    padding-top: 24px;
  }
`;

