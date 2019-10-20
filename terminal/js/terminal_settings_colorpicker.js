// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-colorpicker.
 *
 * @suppress {moduleLoad}
 */
import {html} from './lit_element.js';
import {TerminalSettingsElement} from './terminal_settings_element.js';

export class TerminalSettingsColorpickerElement extends
    TerminalSettingsElement {
  static get is() { return 'terminal-settings-colorpicker'; }

  /** @override */
  static get properties() {
    return {
      preference: {
        type: String,
      },
      uiValue_: {
        type: String,
      },
    };
  }

  /** @override */
  render() {
    return html`
        <input type="color" value="${this.uiValue_}"
            @change="${this.onUiChanged_}" />
    `;
  }

  /** @param {!Event} event */
  onUiChanged_(event) {
    super.uiChanged_(event.target.value);
  }
}
