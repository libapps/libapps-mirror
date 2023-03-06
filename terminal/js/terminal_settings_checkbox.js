// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-checkbox.
 *
 * @suppress {moduleLoad}
 */
import {css, html, ifDefined} from './lit.js';
import {TerminalSettingsElement} from './terminal_settings_element.js';


const DEFAULT_CONVERTER = {
  toChecked: (value) => !!value,
  fromChecked: (checked) => checked,
};

export class TerminalSettingsCheckboxElement extends TerminalSettingsElement {
  static get is() { return 'terminal-settings-checkbox'; }

  /** @override */
  static get properties() {
    return {
      preference: {
        type: String,
      },
      ariaLabel: {
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
    this.ariaLabel = undefined;
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
          -webkit-appearance: none;
        }

        #checkbox:before {
          background-color: var(--cros-switch-track-color-inactive);
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
          background-color: var(--cros-switch-knob-color-inactive);
          border-radius: 100%;
          bottom: 0;
          box-shadow: 0 1px 1px 0 var(--cros-shadow-color-key),
                      0 1px 3px 1px var(--cros-shadow-color-ambient);
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
          background-color: var(--cros-switch-track-color-active);
        }

        #checkbox:checked:after {
          background-color: var(--cros-switch-knob-color-active);
          box-shadow:
            0 1px 1px 0 var(--cros-button-active-shadow-color-key-primary),
            0 1px 3px 1px
            var(--cros-button-active-shadow-color-ambient-primary);
          left: calc(100% - 19px + 4px);
        }
    `;
  }

  /** @override */
  render() {
    return html`
        <input id="checkbox" type="checkbox" @change="${this.onUiChanged_}"
            aria-label="${ifDefined(this.ariaLabel)}"
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
