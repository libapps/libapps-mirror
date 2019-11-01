// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-display-manager.
 *
 * lit-element has not been used for this element, due to its programmatic
 * rendering.
 *
 * @suppress {moduleLoad}
 */
import {html, render} from './lit_element.js';

const managerTemplate = html`
  <style>
    .display {
      height: 100%;
      position: relative;
      width: 100%;
    }

    .controls {
      background-color: rgba(0, 0, 0, 0);
      bottom: 0;
      cursor: cell;
      display: none;
      height: 30px;
      left: 0;
      position: absolute;
      right: 0;
      top: 0;
      transition: background-color 2s cubic-bezier(0.22, 0.61, 0.36, 1);
      width: 30px;
      z-index: 1;
    }
    .controls.left{ border-radius: 0 30px 30px 0; right: unset; height: unset; }
    .controls.right{ border-radius: 30px 0 0 30px; left: unset; height: unset; }
    .controls.top{ border-radius: 0 0 30px 30px; bottom: unset; width: unset; }
    .controls.bottom{ border-radius: 30px 30px 0 0; top: unset; width: unset; }

    :host([terminal-splits-enabled="true"]) .controls {
      display: block;
    }

    .controls:hover {
      background-color: rgb(0, 0, 0, 0.3);
    }
  </style>
`;

/**
 * @param {string} slotId
 * @param {function(!Event)} onClick
 * @return {!TemplateResult}
 */
const slotTemplate = (slotId, onClick) => html`
  <div class="display">
    <div @click="${onClick}" class="controls left">
    </div>
    <div @click="${onClick}" class="controls right">
    </div>
    <div @click="${onClick}" class="controls top">
    </div>
    <div @click="${onClick}" class="controls bottom">
    </div>
    <slot name="${slotId}">
    </slot>
  </div>
`;

let lastSlotId = 0;
/** @return {string} */
const generateSlotId = () => `tdm-slot-${++lastSlotId}`;

export class TerminalDisplayManagerElement extends HTMLElement {
  static get is() { return 'terminal-display-manager'; }

  constructor() {
    super();
    this.attachShadow({mode: 'open'});
  }

  /** @override */
  connectedCallback() {
    render(managerTemplate, lib.notNull(this.shadowRoot));

    this.addNewSlot_();
  }

  /** @param {!Event} event */
  onControlsClick_(event) {
    // |this| is the control element, not the host element.
    let this_ = this.getRootNode().host;

    if (this_.getAttribute('terminal-splits-enabled')) {
      this_.addNewSlot_();
    }
  }

  addNewSlot_() {
    const id = generateSlotId();

    const fragment = new DocumentFragment();
    render(slotTemplate(id, this.onControlsClick_), fragment);
    this.shadowRoot.appendChild(fragment);

    this.dispatchEvent(
        new CustomEvent('terminal-display-ready', {detail: {slot: id}}));

    console.warn('slot positioning not yet implemented');
  }
}
