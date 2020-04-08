// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports elements for exposing sub pages.
 *
 * @suppress {moduleLoad}
 */
import {LitElement, html} from './lit_element.js';

const PASSED_THROUGH_OPTION = Symbol('PASSED_THROUGH_OPTION');

export class TerminalSettingsCategoryOptionElement extends LitElement {
  static get is() { return 'terminal-settings-category-option'; }

  /** @override */
  render() {
    return html`
        <slot name="title"></slot>
    `;
  }

  /** @override */
  connectedCallback() {
    super.connectedCallback();

    if (!this.hasAttribute('tabindex')) {
      this.tabIndex = 0;
    }

    this.addEventListener('click', this.onEvent_);
    this.addEventListener('keydown', this.onEvent_);
  }

  /** @override */
  disconnectedCallback() {
    super.disconnectedCallback();

    this.removeEventListener('click', this.onEvent_);
    this.removeEventListener('keydown', this.onEvent_);
  }

  /** @param {!Event} event */
  onEvent_(event) {
    lib.assert(!event[PASSED_THROUGH_OPTION]);
    event[PASSED_THROUGH_OPTION] = this;
  }
}

customElements.define(TerminalSettingsCategoryOptionElement.is,
    TerminalSettingsCategoryOptionElement);

export class TerminalSettingsCategorySelectorElement extends LitElement {
  static get is() { return 'terminal-settings-category-selector'; }

  /** @override */
  render() {
    return html`
        <slot></slot>
    `;
  }

  /** @override */
  connectedCallback() {
    super.connectedCallback();

    this.activate_(lib.notNull(this.firstElementChild));
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
    if (!event[PASSED_THROUGH_OPTION]) {
      return;
    }
    this.activate_(event[PASSED_THROUGH_OPTION]);
  }

  /** @param {!Event} event */
  onKeyDown_(event) {
    if (!event[PASSED_THROUGH_OPTION]) {
      return;
    }
    switch (event.code) {
      case 'Enter':
      case 'Space':
        this.activate_(event[PASSED_THROUGH_OPTION]);
        break;
    }
  }

  /** @param {!Element} element */
  activate_(element) {
    this.querySelectorAll('[active]').forEach((active) => {
      active.removeAttribute('active');
    });

    element.setAttribute('active', '');
    this.dispatchEvent(new CustomEvent('category-change', {
      detail: {
        category: element.getAttribute('for'),
      },
    }));
  }
}

customElements.define(TerminalSettingsCategorySelectorElement.is,
    TerminalSettingsCategorySelectorElement);
