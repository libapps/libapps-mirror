// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports a Polymer element terminal-settings-checkbox.
 */
import {html} from './polymer.js';
import {TerminalSettingsElement} from './terminal_settings_element.js';

export class TerminalSettingsCheckboxElement extends TerminalSettingsElement {
  static get is() { return 'terminal-settings-checkbox'; }

  static get properties() {
    return {
      description: {
        type: String,
      },
      preference: {
        type: String,
      },
      uiValue_: {
        type: Boolean,
        observer: 'uiChanged_',
      },
    };
  }

  static get template() {
    return html`
        <label for="checkbox">[[description]]</label>
        <input id="checkbox" type="checkbox" checked="{{uiValue_::change}}" />
    `;
  }
}
