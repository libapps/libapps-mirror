// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-ansi-colors.
 *
 * @suppress {moduleLoad}
 */

import {hterm} from '../../hterm/index.js';

import {css, html} from './lit.js';
import {TerminalSettingsElement} from './terminal_settings_element.js';
import {DEFAULT_ANSI_COLORS} from './terminal_common.js';

const rows = [[0, 1, 2, 3, 4, 5, 6, 7], [8, 9, 10, 11, 12, 13, 14, 15]];

export class TerminalSettingsAnsiColorsElement extends
    TerminalSettingsElement {
  static get is() { return 'terminal-settings-ansi-colors'; }

  /** @override */
  static get properties() {
    return {
      preference: {
        type: String,
      },
      value: {
        type: Array,
      },
    };
  }

  /** @override */
  static get styles() {
    return css`
        .color-row {
          display: flex;
          flex-wrap: nowrap;
        }
    `;
  }

  /** @override */
  render() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);
    return html`${rows.map((row) => html`
        <div class="color-row">${row.map((i) => html`
          <terminal-colorpicker data-index="${i}" value="${this.value[i]}"
              title="${msg(`TERMINAL_TITLE_ANSI_COLOR_TOOLTIP_${i}`)}"
              @change="${this.onColorChanged_}" inputInDialog/>`)}
        </div>`)}`;
  }

  /** @override */
  preferenceChanged_(value) {
    if (!value) {
      this.value = DEFAULT_ANSI_COLORS;
    } else {
      this.value = value;
    }
  }

  /**
   * Handle 'change' event when one of the colors changes.
   *
   * @param {!CustomEvent} event Event with index and value.
   * @private
   */
  onColorChanged_(event) {
    this.value[event.target.dataset.index] = event.target.value;
    super.uiChanged_(this.value);
  }
}

customElements.define(TerminalSettingsAnsiColorsElement.is,
    TerminalSettingsAnsiColorsElement);
