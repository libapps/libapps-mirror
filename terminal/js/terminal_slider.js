// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-slider
 *
 * @suppress {moduleLoad}
 */

import {lib} from '../../libdot/index.js';

import {LitElement, css, html} from './lit.js';
import {CHROME_VERSION} from './terminal_common.js';

export const ARROW_KEY_OFFSET = 0.01;

/** A slider element. It dispatches "change" event when the value changes. The
 * `value` ranges from 0 to 1. */
export class TerminalSlider extends LitElement {
  /** @override */
  static get properties() {
    return {
      value: {
        type: Number,
        reflect: true,
      },
      // For slotted elements (e.g. <terminal-knob>) to style itself.
      focusVisible: {
        type: Boolean,
        reflect: true,
      },
    };
  }

  /** @override */
  static get styles() {
    return css`
        :host {
          cursor: pointer;
          display: block;
          height: 16px;
          position: relative;
        }

        #knob-container {
          outline: none;
          pointer-events: none;
          position: absolute;
          top: 50%;
          z-index: 2;
        }
    `;
  }

  /** @override */
  render() {
    return html`
        <slot></slot>
        <div id="knob-container" tabindex=0 style="left: ${100 * this.value}%;"
            @keydown="${this.onKeydown_}"
            @focus="${this.onFocus_}"
            @blur="${() => this.focusVisible = false}">
          <slot name="knob"></slot>
        </div>
    `;
  }

  constructor() {
    super();

    /** @public {number} */
    this.value;
    /** @public {boolean} */
    this.focusVisible;
  }

  /** @override */
  connectedCallback() {
    super.connectedCallback();

    this.addEventListener('pointerdown', this.onPointerDown_);
    this.addEventListener('pointerup', this.onPointerUp_);
  }

  /** @override */
  disconnectedCallback() {
    this.removeEventListener('pointerdown', this.onPointerDown_);
    this.removeEventListener('pointerup', this.onPointerUp_);

    super.disconnectedCallback();
  }

  onFocus_() {
    this.focusVisible = this.shadowRoot.getElementById(
        'knob-container').matches(
            CHROME_VERSION >= 87 ? ':focus-visible' : ':focus');
  }

  onKeydown_(event) {
    switch (event.code) {
      case 'ArrowLeft':
      case 'ArrowUp':
        this.update_(this.value - ARROW_KEY_OFFSET);
        event.preventDefault();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        this.update_(this.value + ARROW_KEY_OFFSET);
        event.preventDefault();
        break;
    }
  }

  /** @param {!Event} event */
  onPointerDown_(event) {
    this.addEventListener('pointermove', this.onPointerMove_);
    this.setPointerCapture(event.pointerId);
    this.onPointerEvent_(event);
  }

  /** @param {!Event} event */
  onPointerMove_(event) {
    this.onPointerEvent_(event);
  }

  /** @param {!Event} event */
  onPointerUp_(event) {
    this.removeEventListener('pointermove', this.onPointerMove_);
    this.releasePointerCapture(event.pointerId);
    this.onPointerEvent_(event);
    this.shadowRoot.getElementById('knob-container').focus();
  }

  /** @param {!Event} event */
  onPointerEvent_(event) {
    this.update_(event.offsetX / this.clientWidth);
  }

  update_(value) {
    this.value = lib.f.clamp(value, 0, 1);
    this.dispatchEvent(new CustomEvent('change', {bubbles: true}));
  }
}

customElements.define('terminal-slider', TerminalSlider);
