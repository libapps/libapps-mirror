// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {hterm} from '../../hterm/index.js';

import {css, html, live} from './lit.js';
import {TerminalSettingsElement} from './terminal_settings_element.js';


export class TerminalSettingsScrollbackLimit extends TerminalSettingsElement {
  /** @override */
  static get properties() {
    return {
      value: {
        state: true,
      },
    };
  }

  /** @override */
  static get styles() {
    return css`
      :host {
        width: 140px;
      }
    `;
  }

  constructor() {
    super();

    this.preference = 'scrollback-limit';
  }

  /** @override */
  render() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);

    let text = '';
    if (typeof this.value === 'number' && this.value >= 0) {
      text = this.value.toString();
    }
    return html`
        <terminal-textfield
            ariaLabel="${msg('TERMINAL_NAME_PREF_SCROLLBACK_LIMIT')}"
            inputType="number"
            .value=${live(text)}
            @change=${this.onInputChange_}>
        </terminal-textfield>
    `;
  }

  onInputChange_(e) {
    const value = parseInt(e.target.value, 10);
    this.uiChanged_(isNaN(value) || value < 0 ? -1 : value);
    // Force update so that if the user inputs a negative value the second time,
    // the input will still be clear.
    this.requestUpdate();
  }
}

customElements.define('terminal-settings-scrollback-limit',
    TerminalSettingsScrollbackLimit);
