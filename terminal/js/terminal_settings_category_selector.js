// Copyright 2019 The Chromium OS Authors. All rights reserved.
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
      ::slotted(div) {
        border: 1px solid rgba(0, 0, 0, 0);
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

      ::slotted(div:hover) {
        background-color: rgb(240, 240, 240);
      }

      ::slotted(div[active]) {
        background-color: var(--active-bg);
        color: rgb(26, 115, 232);
      }

      ::slotted(div:focus-visible) {
        border-color: rgb(26, 115, 232);
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
    super.firstUpdated(changedProperties);

    for (const option of this.children) {
      option.addEventListener('click', () => this.activate_(option));
      option.addEventListener('keydown', (e) => {
        if (e.code == 'Enter' || e.code == 'Space') {
          this.activate_(option);
        }
      });
      option.setAttribute('tabindex', 0);  // Make option focusable.
      option.setAttribute('role', 'link');
    }
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
