// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports a Polymer element terminal-settings-dropdown.
 */
import {html} from './polymer.js';
import {TerminalSettingsElement} from './terminal_settings_element.js';

export class TerminalSettingsDropdownElement extends TerminalSettingsElement {
  static get is() { return 'terminal-settings-dropdown'; }

  static get properties() {
    return {
      description: {
        type: String,
      },
      preference: {
        type: String,
      },
      uiValue_: {
        type: String,
        observer: 'uiChanged_',
      },
    };
  }

  static get template() {
    return html`
        <label for="select">[[description]]</label>
        <select id="select" value="{{uiValue_::change}}">
          <template is="dom-repeat" items="[[options_]]">
            <option value="[[item]]" selected$="{{selected_(item)}}">
              [[item]]
            </option>
          </template>
        </select>
    `;
  }

  connectedCallback() {
    super.connectedCallback();

    this.set('options_',
        window.PreferenceManager.defaultPreferences[this.preference].type);
  }

  selected_(value) {
    return this.uiValue_ === value;
  }
}
