// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-fonts
 *
 * @suppress {moduleLoad}
 */

import {hterm} from '../../hterm/index.js';

import {LitElement, html, ifDefined} from './lit.js';
import {SUPPORTED_FONT_FAMILIES, fontFamilyToCSS, fontManager}
    from './terminal_common.js';
import './terminal_dropdown.js';

export class TerminalSettingsFonts extends LitElement {
  /** @override */
  static get properties() {
    return {
      loadedFonts_: {
        state: true,
      },
      ariaLabel: {
        type: String,
      },
    };
  }

  constructor() {
    super();

    this.loadedFonts_ = [];
    this.ariaLabel = undefined;
    // Tests might overwrite this.
    this.fontManager_ = fontManager;
  }

  /** @override */
  connectedCallback() {
    super.connectedCallback();

    if (this.loadedFonts_.length === 0) {
      for (const font of SUPPORTED_FONT_FAMILIES) {
        this.fontManager_.loadFont(font).then(() => {
          this.loadedFonts_.push(font);
          this.requestUpdate();
        });
      }
    }
  }

  /** @override */
  render() {
    const options = SUPPORTED_FONT_FAMILIES.map(
        (font) => ({
          value: fontFamilyToCSS(font),
          label: font,
          style: `font-family: ${font}`,
          disabled: !this.loadedFonts_.includes(font),
        }),
    );
    return html`
        <terminal-settings-dropdown
            ariaLabel="${ifDefined(this.ariaLabel)}"
            preference="font-family"
            title="${hterm.messageManager.get('HTERM_PREF_FONT_FAMILY')}"
            .options="${options}">
        </terminal-settings-dropdown>
    `;
  }
}

customElements.define('terminal-settings-fonts',
    TerminalSettingsFonts);
