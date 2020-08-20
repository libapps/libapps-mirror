// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-button.
 *
 * @suppress {moduleLoad}
 */

import {LitElement, css, html} from './lit_element.js';
import {stylesVars} from './terminal_settings_styles.js';

export class TerminalSettingsButtonElement extends LitElement {
  static get is() { return 'terminal-settings-button'; }

  /** @override */
  static get styles() {
    return [stylesVars, css`
        :host {
          --button-bg: white;
          --button-bg-action: var(--google-blue-600);
          --button-border-color: var(--google-blue-600);
          --button-hover-bg: rgba(var(--google-blue-refresh-500-rgb), .04);
          --button-hover-bg-action: rgba(var(--google-blue-600-rgb), .9);
          --button-text-color: var(--google-blue-600);
          --button-text-color-action: white;
        }

        button {
          background-color: var(--button-bg);
          border: 1px solid var(--button-border-color);
          border-radius: 4px;
          color: var(--button-text-color);
          cursor: pointer;
          font-family: var(--font);
          font-weight: 500;
          min-width: 5.14em;
          outline: none;
          padding: 8px 16px;
        }

        button:focus-visible {
          box-shadow: 0 0 0 2px var(--focus-shadow-color);
        }

        button:hover {
          background-color: var(--button-hover-bg);
        }

        :host(.action) button {
          background-color: var(--button-bg-action);
          color: var(--button-text-color-action);
        }

        :host(.action) button:hover {
          background-color: var(--button-hover-bg-action);
        }

        :host(.cancel) {
          margin-inline-end: 8px;
        }
    `];
  }

  /** @override */
  render() {
    return html`<button><slot></slot></button>`;
  }
}

customElements.define(TerminalSettingsButtonElement.is,
    TerminalSettingsButtonElement);
