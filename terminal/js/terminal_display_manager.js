// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-display-manager.
 *
 * lit-element has not been used for this element, due to its programmatic
 * rendering.
 */

let lastSlotId = 0;
/** @return {string} */
const generateSlot = () => `tdm-slot-${++lastSlotId}`;

export class TerminalDisplayManagerElement extends HTMLElement {
  static get is() { return 'terminal-display-manager'; }

  constructor() {
    super();
    this.attachShadow({mode: 'open'});
  }

  /** @override */
  connectedCallback() {
    const slot = document.createElement('slot');
    slot.name = generateSlot();

    const display = document.createElement('div');
    display.classList.add('display');
    display.appendChild(slot);

    this.shadowRoot.appendChild(display);

    this.dispatchEvent(
        new CustomEvent('terminal-display-ready', {detail: {slot: slot.name}}));
  }
}
