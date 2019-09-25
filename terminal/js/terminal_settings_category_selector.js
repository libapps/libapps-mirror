// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports Polymer elements for exposing sub pages.
 *
 * @suppress {checkTypes}
 */
import {PolymerElement, html} from './polymer.js';

export class TerminalSettingsCategoryOptionElement extends PolymerElement {
  static get is() { return 'terminal-settings-category-option'; }

  static get template() {
    return html`
        <slot name="title"></slot>
    `;
  }
}

export class TerminalSettingsCategorySelectorElement extends PolymerElement {
  static get is() { return 'terminal-settings-category-selector'; }

  static get template() {
    return html`
        <slot on-click="clicked_"></slot>
    `;
  }

  connectedCallback() {
    super.connectedCallback();
    this.activate_(this.firstElementChild);
  }

  clicked_(event) {
    this.querySelectorAll('[active]')
        .forEach(section => this.deactivate_(section));
    let section = event.target;
    while (section.parentElement !== this) {
      section = section.parentElement;
    }
    this.activate_(section);
  }

  activate_(element) {
    element.setAttribute('active', '');
    const id = element.getAttribute('for');
    document.getElementById(id).setAttribute('active-category', '');
  }

  deactivate_(element) {
    element.removeAttribute('active');
    const id = element.getAttribute('for');
    document.getElementById(id).removeAttribute('active-category');
  }
}
