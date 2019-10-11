// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-checkbox.
 *
 * @suppress {moduleLoad}
 */
import {html} from './lit_element.js';
import {TerminalSettingsElement} from './terminal_settings_element.js';

export class TerminalSettingsCheckboxElement extends TerminalSettingsElement {
  static get is() { return 'terminal-settings-checkbox'; }

  /** @override */
  static get properties() {
    return {
      preference: {
        type: String,
      },
      uiValue_: {
        type: Boolean,
      },
    };
  }

  constructor() {
    super();
    /** @type {string} */
    this.description;
  }

  /** @override */
  render() {
    return html`
        <input id="checkbox" type="checkbox" @change=${this.onUiChanged_}
            ?checked=${this.uiValue_} />
    `;
  }

  /** @param {!Event} event */
  onUiChanged_(event) {
    super.uiChanged_(event.target.checked);
  }
}
