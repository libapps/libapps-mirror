// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: saturation-value-picker
 *
 * @suppress {moduleLoad}
 */

import {lib} from '../../libdot/index.js';

import {LitElement, css, html} from './lit.js';
import './terminal_knob.js';

export const ARROW_KEY_OFFSET = 1;

export class SaturationValuePickerElement extends LitElement {
  static get is() { return 'saturation-value-picker'; }

  /** @override */
  static get properties() {
    return {
      hue: {
        type: Number,
      },
      saturation: {
        type: Number,
        reflect: true,
      },
      value: {
        type: Number,
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
          height: 160px;
          position: relative;
          width: 200px;
        }

        #picker {
          left: 50%;
          pointer-events: none;
          position: absolute;
          top: 50%;
          z-index: 2;
        }

        #black-to-transparent, #white-to-pure {
          border-radius: 8px;
          height: 100%;
          pointer-events: none;
          position: absolute;
          width: 100%;
          z-index: 1;
        }

        #black-to-transparent {
          background: linear-gradient(to top, #000000 0%, #00000000 100%);
          z-index: 2;
        }
    `;
  }

  /** @override */
  render() {
    const whiteToPureStyle = `background: linear-gradient(to right, ` +
        `#ffffff 0%, hsl(${this.hue}, 100%, 50%) 100%);`;
    const color = lib.colors.arrayToHSLA(
        lib.colors.hsvxArrayToHslaArray(
            [this.hue, this.saturation, this.value]));
    const pickerStyle = `left: ${this.saturation}%; ` +
        `top: ${100 - this.value}%; background-color: ${color};`;

    return html`
        <div id="black-to-transparent"></div>
        <div id="white-to-pure" style="${whiteToPureStyle}"></div>
        <terminal-knob id="picker" tabindex="0" style="${pickerStyle}"
            @keydown="${this.onKeydown_}">
        </terminal-knob>
    `;
  }

  constructor() {
    super();

    /** @private {number} */
    this.hue;
    /** @private {number} */
    this.saturation;
    /** @private {number} */
    this.value;
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
    this.shadowRoot.getElementById('picker').focus();
  }

  onKeydown_(event) {
    switch (event.code) {
      case 'ArrowLeft':
        this.update_(this.saturation - ARROW_KEY_OFFSET, this.value);
        event.preventDefault();
        break;
      case 'ArrowRight':
        this.update_(this.saturation + ARROW_KEY_OFFSET, this.value);
        event.preventDefault();
        break;
      case 'ArrowUp':
        this.update_(this.saturation, this.value + ARROW_KEY_OFFSET);
        event.preventDefault();
        break;
      case 'ArrowDown':
        this.update_(this.saturation, this.value - ARROW_KEY_OFFSET);
        event.preventDefault();
        break;
    }
  }

  /** @param {!Event} event */
  onPointerEvent_(event) {
    this.update_(100 * (event.offsetX / this.clientWidth),
        100 * (1 - event.offsetY / this.clientHeight));
  }

  /**
   * @param {number} saturation
   * @param {number} value
   */
  update_(saturation, value) {
    this.saturation = lib.f.clamp(saturation, 0, 100);
    this.value = lib.f.clamp(value, 0, 100);

    this.dispatchEvent(new CustomEvent('change', {bubbles: true}));
  }
}

customElements.define(SaturationValuePickerElement.is,
    SaturationValuePickerElement);
