// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-dropdown.
 */
import {html} from './lit_element.js';
import {TerminalSettingsElement} from './terminal_settings_element.js';

export class TerminalSettingsDropdownElement extends TerminalSettingsElement {
  static get is() { return 'terminal-settings-dropdown'; }

  static get properties() {
    return {
      preference: {
        type: String,
      },
      options_: {
        type: Array,
      },
      uiValue_: {
        type: String,
      },
    };
  }

  render() {
    return html`
        <select id="select" value=${this.uiValue_} @change=${this.uiChanged_}>
        ${this.options_.map(
          option => html`<option value=${option}
              ?selected=${this.uiValue_ === option}>${option}</option>
          `
        )}
        </select>
    `;
  }

  connectedCallback() {
    super.connectedCallback();

    this.options_ =
        window.PreferenceManager.defaultPreferences[this.preference].type;
  }

  uiChanged_(event) {
    super.uiChanged_(event.target.value);
  }
}
