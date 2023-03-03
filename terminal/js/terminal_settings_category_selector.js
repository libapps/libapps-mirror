// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports elements for exposing sub pages.
 *
 * @suppress {moduleLoad}
 */
import {css, LitElement, html} from './lit.js';

export class TerminalSettingsCategorySelectorElement extends LitElement {
  static get is() { return 'terminal-settings-category-selector'; }

  /** @override */
  static get styles() {
    return css`
      ::slotted(*) {
        border-radius: 0 16px 16px 0;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        line-height: 32px;
        margin: 8px 0;
        outline: none;
        padding: 0 24px 0 32px;
        user-select: none;
      }

      ::slotted(:hover), ::slotted(:focus) {
        background-color: var(--cros-textfield-background-color);
      }

      ::slotted([active]) {
        background-color: var(--cros-highlight-color);
        color: var(--cros-color-prominent);
      }

      ::slotted(:focus-visible) {
        border-color: var(--cros-color-prominent);
      }

      ::slotted(terminal-settings-profile-item) {
        padding-left: 52px;
      }

      :host([tabs]) {
        border-bottom: 1px solid var(--cros-separator-color);
        display: flex;
        margin-top: 18px;
      }

      :host([tabs]) ::slotted(*) {
        border-radius: 0;
        margin: 0 16px 0 0;
        padding: 0 8px;
      }

      :host([tabs]) ::slotted([active]) {
        background-color: inherit;
        border-bottom: 2px solid var(--cros-color-prominent);
      }

`;
  }

  constructor() {
    super();

    /** @type {?Element} */
    this.activeElement_ = null;
  }

  /** @override */
  render() {
    return html`<slot></slot>`;
  }

  /** @override */
  firstUpdated(changedProperties) {
    this.addEventListener('click', (e) => {
      if (e.target.parentElement !== this) {
        return;
      }
      this.activate_(/** @type {!Element} */(e.target));
    });
    this.addEventListener('keydown', (e) => {
      if (e.target.parentElement !== this) {
        return;
      }
      if (e.code == 'Enter' || e.code == 'Space') {
        this.activate_(/** @type {!Element} */(e.target));
      }
    });
    this.shadowRoot.querySelector('slot').addEventListener(
        'slotchange', (e) => {
          for (const option of this.children) {
            option.setAttribute('tabindex', 0);  // Make option focusable.
            option.setAttribute('role', 'link');
          }
        });
    if (this.firstElementChild) {
      this.activate_(this.firstElementChild);
    }
  }

  /** @param {!Element} element */
  activate_(element) {
    if (this.activeElement_) {
      this.activeElement_.removeAttribute('active');
    }
    this.activeElement_ = element;
    element.setAttribute('active', '');
    this.dispatchEvent(new CustomEvent('category-change', {
      detail: {
        category: element.getAttribute('data-name'),
      },
    }));
  }
}

customElements.define(TerminalSettingsCategorySelectorElement.is,
    TerminalSettingsCategorySelectorElement);
