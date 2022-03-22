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

export const stylesDialog = css`
  dialog {
    border: 0;
    border-radius: 8px;
    box-shadow: 0 0 16px rgba(0, 0, 0, 0.12),
                0 16px 16px rgba(0, 0, 0, 0.24);
    color: var(--cr-secondary-text-color);
    padding: 20px 20px 16px 20px;
  }

  .dialog-title {
    color: var(--cr-primary-text-color);
    font-size: calc(15 / 13 * 100%);
    padding-bottom: 16px;
  }

  .dialog-button-container {
    display: flex;
    justify-content: flex-end;
    padding-top: 24px;
  }
`;
