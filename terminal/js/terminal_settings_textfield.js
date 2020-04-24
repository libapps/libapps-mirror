// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-text.
 *
 * @suppress {moduleLoad}
 */
import {html} from './lit_element.js';
import {TerminalSettingsElement} from './terminal_settings_element.js';
import './terminal_textfield.js';

const DEFAULT_CONVERTER = {
  preferenceToDisplay: (v) => v,
  displayToPreference: (v) => v,
};

export class TerminalSettingsTextfieldElement extends TerminalSettingsElement {
  static get is() { return 'terminal-settings-textfield'; }

  /** @override */
  static get properties() {
    return {
      preference: {
        type: String,
      },
      // The preference value. See property |converter|.
      value: {},
      // An optional converter, which converts preference value to/from display.
      converter: {
        type: Object,
        attribute: false,
      },
    };
  }

  constructor() {
    super();

    /**
     * @public {{preferenceToDisplay: function(*): string,
     *           displayToPreference: function(string): *}}
     */
    this.converter = DEFAULT_CONVERTER;
  }

  /** @override */
  render() {
    return html`
        <terminal-textfield
            .value="${this.converter.preferenceToDisplay(this.value)}"
            @change="${this.onUiChanged_}"
        >
        </terminal-textfield>
    `;
  }

  /** @param {!Event} event */
  onUiChanged_(event) {
    super.uiChanged_(this.converter.displayToPreference(event.target.value));
  }
}

customElements.define(TerminalSettingsTextfieldElement.is,
    TerminalSettingsTextfieldElement);
