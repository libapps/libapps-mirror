// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-fonts
 *
 * @suppress {moduleLoad}
 */
import {html, LitElement} from './lit.js';
import {SUPPORTED_FONT_FAMILIES, fontFamilyToCSS, fontManager,
  getSupportedFontFamilies} from './terminal_common.js';
import './terminal_dropdown.js';

export class TerminalSettingsFonts extends LitElement {
  /** @override */
  static get properties() {
    return {
      loadedFonts_: {
        state: true,
      },
    };
  }

  constructor() {
    super();

    this.loadedFonts_ = [];
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

    window.preferenceManager.addObserver(
      'terminal-emulator', () => this.requestUpdate());
  }

  /** @override */
  render() {
    const fonts = getSupportedFontFamilies(window.preferenceManager);
    const options = fonts.map(
        (font) => ({
          value: fontFamilyToCSS(font),
          label: font,
          style: `font-family: ${font}`,
          disabled: !this.loadedFonts_.includes(font),
        }),
    );
    return html`
        <terminal-settings-dropdown preference="font-family"
            title="${hterm.messageManager.get('HTERM_PREF_FONT_FAMILY')}"
            .options="${options}">
        </terminal-settings-dropdown>
    `;
  }
}

customElements.define('terminal-settings-fonts',
    TerminalSettingsFonts);
