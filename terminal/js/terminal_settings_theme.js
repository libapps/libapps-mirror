// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-theme.
 *
 * @suppress {moduleLoad}
 */
import {css, html, LitElement} from './lit_element.js';

export class TerminalSettingsThemeElement extends LitElement {
  static get is() { return 'terminal-settings-theme'; }

  /** @override */
  static get properties() {
    return {
      name: {
        type: String,
      },
      backgroundcolor: {
        type: String,
      },
      fontcolor: {
        type: String,
      },
      fontsize: {
        type: Number,
      },
      fontfamily: {
        type: String,
      }
    };
  }

  static get styles() {
    return css`
        #picker {
          cursor: pointer;
          height: 100%;
          position: relative;
          width: 100%;
        }

        #example {
          bottom: 0;
          left: 8px;
          position: absolute;
        }
    `;
  }

  /** @override */
  render() {
    return html`
        <div id="picker" style="background-color: ${this.backgroundcolor}">
          <a id="example" style="
              color: ${this.fontcolor};
              font-size: ${this.fontsize}px;
              font-family: ${this.fontfamily};">
            ${this.name}
          </a>
        </div>
    `;
  }

  constructor() {
    super();

    /** @private {string} */
    this.name;
    /** @private {string} */
    this.backgroundcolor;
    /** @private {string} */
    this.fontcolor;
    /** @private {number} */
    this.fontsize;
    /** @private {string} */
    this.fontfamily;
  }

  /** @override */
  connectedCallback() {
    super.connectedCallback();

    if (!this.hasAttribute('tabindex')) {
      this.tabIndex = 0;
    }

    this.addEventListener('click', this.onClick_);
    this.addEventListener('keydown', this.onKeyDown_);
  }

  /** @override */
  disconnectedCallback() {
    super.disconnectedCallback();

    this.removeEventListener('click', this.onClick_);
    this.removeEventListener('keydown', this.onKeyDown_);
  }

  /** @param {!Event} event */
  onClick_(event) {
    this.activate_();
  }

  /** @param {!Event} event */
  onKeyDown_(event) {
    switch (event.code) {
      case 'Enter':
        this.activate_();
        break;
      case 'Space':
        this.activate_();
        // Default behaviour is to scroll the page on Space.
        event.preventDefault();
        break;
    }
  }

  activate_() {
    window.preferenceManager.set('background-color', this.backgroundcolor);
    window.preferenceManager.set('foreground-color', this.fontcolor);
    window.preferenceManager.set('font-size', this.fontsize);
    window.preferenceManager.set('font-family', this.fontfamily);

  }
}

customElements.define(TerminalSettingsThemeElement.is,
    TerminalSettingsThemeElement);
