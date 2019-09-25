// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports a Polymer element terminal-settings-colorpicker.
 */
import {html} from './polymer.js';
import {TerminalSettingsElement} from './terminal_settings_element.js';

export class TerminalSettingsColorpickerElement extends
    TerminalSettingsElement {
  static get is() { return 'terminal-settings-colorpicker'; }

  static get properties() {
    return {
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
        <input type="color" value="{{uiValue_::change}}" />
    `;
  }
}
