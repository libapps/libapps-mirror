// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Implement element <terminal-tooltip>
 */

import {LitElement, css, html} from './lit.js';

/**
 * A tooltip element that looks like the native tooltip.
 *
 * TODO: respect dark mode.
 */
export class TerminalTooltip extends LitElement {
  /** @override */
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

  /** @override */
  static get styles() {
    return css`
        :host {
          background-color: rgba(255, 255, 255, .8);
          border: 1px solid black;
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

    const {height, width} = this.getBoundingClientRect();
    this.style.top = `${this.adjustPos_(cursorPosition.y + 8, height,
        window.innerHeight)}px`;
    this.style.left =
        `${this.adjustPos_(cursorPosition.x + 8, width, window.innerWidth)}px`;
    this.style.visibility = 'visible';
  }

  hide() {
    // Set this to empty string to prevent an on-going show() to set the
    // visibility back.
    this.content_ = '';
    this.style.visibility = 'hidden';
  }

  /** @override */
  render() {
    return html`${this.content_}`;
  }

  /**
   * @param {number} pos
   * @param {number} size
   * @param {number} boundary
   * @return {number}
   */
  adjustPos_(pos, size, boundary) {
    if (pos + size <= boundary) {
      return pos;
    }
    // The right/bottom of the element exceeds the boundary. We need to move
    // left/up to make room for it.
    return Math.max(0, boundary - size);
  }
}

customElements.define('terminal-tooltip', TerminalTooltip);
