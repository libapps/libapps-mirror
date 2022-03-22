// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-fonts
 *
 * @suppress {moduleLoad}
 */
import {html, LitElement} from './lit.js';
import {SUPPORTED_FONT_FAMILIES, fontFamilyToCSS} from './terminal_common.js';
import './terminal_settings_dropdown.js';

export class TerminalSettingsFonts extends LitElement {
  /** @override */
  static get properties() {
    return {
      loadedWebFonts_: {
        type: Array,
      },
    };
  }

  constructor() {
    super();

    this.loadedWebFonts_ = [];
    window.webFontPromises.forEach(async (promise, font) => {
      try {
        await promise;  // Ignore return value. It must be true.
        this.loadedWebFonts_.push(font);
        this.requestUpdate();
      } catch (error) {
        // Do nothing.
      }
    });
  }

  /** @override */
  render() {
    const options = Array.from(SUPPORTED_FONT_FAMILIES).map(
        ([font, isWebFont]) => ({
          value: fontFamilyToCSS(font),
          label: font,
          style: `font-family: ${font}`,
          disabled: isWebFont && !this.loadedWebFonts_.includes(font),
        }),
    );
    return html`
        <terminal-settings-dropdown preference="font-family"
            .options="${options}">
        </terminal-settings-dropdown>
    `;
  }
}

customElements.define('terminal-settings-fonts',
    TerminalSettingsFonts);
