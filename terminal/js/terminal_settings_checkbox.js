// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-checkbox.
 *
 * @suppress {moduleLoad}
 */
import {css, html} from './lit_element.js';
import {TerminalSettingsElement} from './terminal_settings_element.js';

export class TerminalSettingsCheckboxElement extends TerminalSettingsElement {
  static get is() { return 'terminal-settings-checkbox'; }

  /** @override */
  static get properties() {
    return {
      preference: {
        type: String,
      },
      value: {
        type: Boolean,
        reflect: true,
      },
    };
  }

  static get styles() {
    return css`
        #checkbox {
          cursor: pointer;
          height: 15px;
          margin: 0;
          padding: 0;
          position: relative;
          width: 38px;
        }

        #checkbox:before {
          background-color: rgb(201, 206, 214);
          border-radius: 15px;
          bottom: 0;
          content: "";
          display: block;
          left: 0;
          position: absolute;
          right: 0;
          top: 0;
          transition: all 75ms ease;
        }

        #checkbox:after {
          background-color: rgb(151, 162, 179);
          border-radius: 100%;
          bottom: 0;
          box-shadow: 1px 1px 3.5px 0px rgb(180, 180, 180);
          content: "";
          display: block;
          left: 0;
          margin: -2px;
          position: absolute;
          top: 0;
          transition: all 75ms ease-in-out;
          width: 19px;
        }

        #checkbox:checked:before {
          background-color: rgb(160, 194, 249);
        }

        #checkbox:checked:after {
          background-color: rgb(66, 133, 244);
          box-shadow: 1px 1px 3.5px 0px rgb(160, 194, 249);
          left: calc(100% - 19px + 4px);
        }
    `;
  }

  /** @override */
  render() {
    return html`
        <input id="checkbox" type="checkbox" @change="${this.onUiChanged_}"
            .checked="${this.value}" />
    `;
  }

  /** @param {!Event} event */
  onUiChanged_(event) {
    super.uiChanged_(event.target.checked);
  }
}
