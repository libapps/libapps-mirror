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
      label: {attribute: false},
      items: {attribute: false},
    };
  }

  constructor() {
    super();

    /**
     * @public {string}
     */
    this.label = '';

    /**
     * @public {!Array<{name: string, action: function()}>}
     */
    this.items = [];
    this.selected_ = -1;

    this.hideBound_ = this.hide.bind(this);
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

        ul:focus, li:focus {
          outline: none;
        }

        li:focus, li:hover {
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
  async show(cursorPosition) {
    // Ensure render is finished before we show.
    await this.updateComplete;

    positionElementWithinWindow(this, cursorPosition);
    this.style.visibility = 'visible';

    // Hide on any click or keydown event.
    const options = {capture: true};
    const removeAndHide = () => {
      this.ownerDocument.removeEventListener('click', onClick, options);
      this.ownerDocument.removeEventListener('keydown', onKeydown, options);
      this.hide();
    };
    const onClick = removeAndHide;
    // Esc or char key will hide the menu, but allow Tab, Arrows for navigation.
    const onKeydown = (e) => {
      if (e.keyCode == 0x1b || e.keyCode >= 0x30) {
        removeAndHide();
      }
    };
    this.ownerDocument.addEventListener('click', onClick, options);
    this.ownerDocument.addEventListener('keydown', onKeydown, options);
    this.renderRoot.querySelector('ul').focus();
    this.selected_ = -1;
  }

  hide() {
    this.style.visibility = 'hidden';
  }

  /** @param {!Event} event */
  onKeydown_(event) {
    switch (event.code) {
      case 'ArrowUp':
        this.selected_--;
        if (this.selected_ < 0) {
          this.selected_ = this.items.length - 1;
        }
        break;
      case 'ArrowDown':
        this.selected_ = (this.selected_ + 1) % this.items.length;
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.renderRoot.querySelectorAll('li')[this.selected_].focus();
  }

  /** @override */
  render() {
    return html`
      <ul tabindex="0" role="menu" aria-label="${this.label}"
          @keydown=${this.onKeydown_}>
        ${this.items.map((i) => html`
          <li tabindex="0" role="menuitem"
              @click=${(e) => {
                this.hide();
                i.action();
              }}
              @keydown=${(e) => {
                if (['Enter', 'Space'].includes(e.code)) {
                  e.preventDefault();
                  this.hide();
                  i.action();
                }
              }
          }>
          ${i.name}
          </li>`)}
      </ul>
    `;
  }
}

customElements.define('terminal-context-menu', TerminalContextMenu);
