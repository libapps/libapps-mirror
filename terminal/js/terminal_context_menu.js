// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Implement element <terminal-context-menu>
 */

import {LitElement, css, html} from './lit.js';
import {positionElementWithinWindow} from './terminal_common.js';

/**
 * A context menu that can be positioned any where in the window.
 */
export class TerminalContextMenu extends LitElement {
  /** @override */
  static get properties() {
    return {
      items: {
        attribute: false,
      },
    };
  }

  constructor() {
    super();

    /**
     * @public {!Array<{name: string, action: function()}>}
     */
    this.items = [];
  }

  /** @override */
  static get styles() {
    return css`
        :host {
          display: block;
          position: fixed;
        }

        ul {
          background-color: var(--cros-bg-color);
          border-radius: 4px;
          box-shadow: 0 1px 2px 0 var(--cros-shadow-color-key),
                      0 2px 6px 2px var(--cros-shadow-color-ambient);
          box-sizing: border-box;
          color: rgb(var(--cros-color-primary));
          font-family: var(--cros-body-1-font-family);
          line-height: 32px;
          list-style: none;
          margin: 0;
          padding: 8px 0;
        }

        li {
          cursor: pointer;
          padding: 0 8px;
          font-size: smaller;
          white-space: nowrap;
        }

        li:hover {
          background-color: var(--cros-highlight-color-hover);
        }
    `;
  }

  /** @override */
  connectedCallback() {
    super.connectedCallback();
    this.hide();
  }

  /**
   * @param {{x: number, y: number}} cursorPosition
   */
  show(cursorPosition) {
    positionElementWithinWindow(this, cursorPosition);
    this.style.visibility = 'visible';
  }

  hide() {
    this.style.visibility = 'hidden';
  }

  /** @override */
  render() {
    return html`
        <ul>
          ${this.items.map((i) => html`
              <li @mousedown="${(e) => e.stopPropagation()}"
                  @mouseup="${(e) => e.stopPropagation()}"
                  @click="${(e) => {
                    this.hide();
                    i.action();
                  }}">
                ${i.name}
              </li>`)}
        </ul>
    `;
  }
}

customElements.define('terminal-context-menu', TerminalContextMenu);
