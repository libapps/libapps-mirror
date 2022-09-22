// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Implement <terminal-settings-row>
 */

import {LitElement, css, html, when} from './lit.js';
import {ICON_EXPAND_LESS, ICON_EXPAND_MORE} from './terminal_icons.js';

/**
 * An expandable row element designed to work within <terminal-settings-app>.
 */
class TerminalSettingsRow extends LitElement {
  /** @override */
  static get properties() {
    return {
      title: {
        type: String,
      },
      label: {
        type: String,
      },
      expandable: {
        type: Boolean,
      },
      expanded_: {
        state: true,
      },
    };
  }

  /** @override */
  static get styles() {
    return css`
        :host {
          display: block;
          border-bottom: 1px solid var(--cros-separator-color);
        }

        :host([expandable]) #main {
          cursor: pointer;
        }

        #main {
          align-items: center;
          display: flex;
          flex-wrap: nowrap;
        }

        #label {
          color: var(--cros-color-primary);
          flex-grow: 1;
          font-weight: 400;
          line-height: 24px;
          margin: 12px 0;
        }
    `;
  }

  constructor() {
    super();

    this.title = '';
    this.label = '';
    this.expandable = false;
    this.expanded_ = false;
  }

  /** @override */
  render() {
    return html`
      <div title="${this.title}">
        <div id="main" @click=${this.onClick_}
            tabindex=${this.expandable ? '0' : ''}
            role=${this.expandable ? 'button' : ''}
            aria-expanded=${this.expandable ? this.expanded_ : ''} >
          <span id="label">${this.label}</span>
          ${when(this.expandable,
              () => this.expanded_ ? ICON_EXPAND_LESS : ICON_EXPAND_MORE,
              () => html`<slot></slot>`)}
        </div>
        ${when(this.expanded_, () => html`<slot></slot>`)}
      </div>
    `;
  }

  onClick_() {
    if (this.expandable) {
      this.expanded_ = !this.expanded_;
      this.dispatchEvent(new CustomEvent('expand', {detail: this.expanded_}));
    }
  }
}

customElements.define('terminal-settings-row', TerminalSettingsRow);
