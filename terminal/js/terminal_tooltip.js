// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Implement element <terminal-tooltip>
 */

import {LitElement, css, html} from './lit.js';
import {positionElementWithinWindow} from './terminal_common.js';

/**
 * A tooltip element that looks like the native tooltip.
 */
export class TerminalTooltip extends LitElement {
  /**
   * @return {!Object<string, !PropertyDeclaration>}
   * @override
   */
  static get properties() {
    return {
      content_: {
        type: String,
      },
    };
  }

  constructor() {
    super();

    this.content_ = '';
  }

  /**
   * @return {!CSSResult|!Array<!CSSResult>}
   * @override
   */
  static get styles() {
    return css`
        :host {
          background-color: var(--cros-bg-color);
          border: 1px solid rgb(var(--cros-separator-color-rgb));
          display: block;
          font-size: smaller;
          padding: 3px 5px;
          position: fixed;
          z-index: 10;
        }
    `;
  }

  /**
   * Show the tooltip.
   *
   * @param {string} content
   * @param {{x: number, y: number}} cursorPosition
   */
  async show(content, cursorPosition) {
    this.content_ = content;
    await this.updateComplete;
    if (!this.content_) {
      return;
    }

    positionElementWithinWindow(this,
        {x: cursorPosition.x, y: cursorPosition.y + 8});
    this.style.visibility = 'visible';
  }

  hide() {
    // Set this to empty string to prevent an on-going show() to set the
    // visibility back.
    this.content_ = '';
    this.style.visibility = 'hidden';
  }

  /**
   * @return {!TemplateResult}
   * @override
   */
  render() {
    return html`${this.content_}`;
  }
}

customElements.define('terminal-tooltip', TerminalTooltip);
