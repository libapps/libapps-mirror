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
import {stylesText} from './terminal_settings_styles.js';

const DEFAULT_CONVERTER = {
  preferenceToDisplay: v => v,
  displayToPreference: v => v,
};

export class TerminalSettingsTextElement extends TerminalSettingsElement {
  static get is() { return 'terminal-settings-text'; }

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
  static get styles() { return stylesText; }

  /** @override */
  render() {
    return html`
        <input id="text" type="text"
            .value="${this.converter.preferenceToDisplay(this.value)}"
            @blur="${this.onUiChanged_}"
            @keyup="${this.onInputKeyup_}"/>
    `;
  }

  /** @param {!Event} event */
  onUiChanged_(event) {
    super.uiChanged_(this.converter.displayToPreference(event.target.value));
  }

  /** @param {!KeyboardEvent} event */
  onInputKeyup_(event) {
    if (event.key === 'Enter') {
      this.onUiChanged_(event);
    }
  }
}

customElements.define(TerminalSettingsTextElement.is,
    TerminalSettingsTextElement);
