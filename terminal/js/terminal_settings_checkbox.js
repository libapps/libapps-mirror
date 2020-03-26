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


const DEFAULT_CONVERTER = {
  toChecked: value => !!value,
  fromChecked: checked => checked,
};

export class TerminalSettingsCheckboxElement extends TerminalSettingsElement {
  static get is() { return 'terminal-settings-checkbox'; }

  /** @override */
  static get properties() {
    return {
      preference: {
        type: String,
      },
      // The preference value, which does not have to be a boolean. See property
      // |converter|.
      value: {
        attribute: false,
      },
      // An optional converter, which converts preference value to/from checked
      // state.
      converter: {
        type: Object,
        attribute: false,
      },
    };
  }

  constructor() {
    super();

    /**
     * @public {{toChecked: function(*): boolean,
     *           fromChecked: function(boolean): *}}
     */
    this.converter = DEFAULT_CONVERTER;
  }

  /** @override */
  static get styles() {
    return css`
        #checkbox {
          cursor: pointer;
          height: 16px;
          margin: 2px 0;
          position: relative;
          width: 38px;
        }

        #checkbox:before {
          background-color: rgb(189, 193, 198);
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
          background-color: rgb(255, 255, 255);
          border-radius: 100%;
          bottom: 0;
          box-shadow: 0 1px 1px 0 rgba(60, 64, 67, 0.3),
                      0 1px 3px 1px rgba(60, 64, 67, 0.15);
          content: "";
          display: block;
          left: 0;
          margin: -2px;
          position: absolute;
          top: 0;
          transition: all 75ms ease-in-out;
          width: 20px;
        }

        #checkbox:checked:before {
          background-color: rgb(160, 194, 249);
        }

        #checkbox:checked:after {
          background-color: rgb(66, 133, 244);
          box-shadow: 0 1px 1px 0 rgba(66, 133, 244, 0.3),
                      0 1px 3px 1px rgba(66, 133, 244, 0.15);
          left: calc(100% - 19px + 4px);
        }
    `;
  }

  /** @override */
  render() {
    return html`
        <input id="checkbox" type="checkbox" @change="${this.onUiChanged_}"
            .checked="${this.converter.toChecked(this.value)}" />
    `;
  }

  /** @param {!Event} event */
  onUiChanged_(event) {
    super.uiChanged_(this.converter.fromChecked(event.target.checked));
  }
}

customElements.define(TerminalSettingsCheckboxElement.is,
    TerminalSettingsCheckboxElement);
