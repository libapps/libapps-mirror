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
    --active-bg: rgb(210, 227, 252);
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

export const stylesDialog = css`
  dialog {
    border: 0;
    border-radius: 8px;
    box-shadow: 0 0 16px rgba(0, 0, 0, 0.12),
                0 16px 16px rgba(0, 0, 0, 0.24);
    padding: 20px;
  }

  #dialog-title {
    font-weight: bold;
    padding: 0 0 20px 0;
  }
`;

export const stylesText = css`
  input[type='text'] {
    background-color: #F1F3F4;
    border-radius: 4px;
    border: none;
    color: #202124;
    font-family: Roboto;
    font-size: 13px;
    outline: none;
    line-height: 32px;
    margin: 8px 0 8px 6px;
    padding: 0 8px;
  }
`;
