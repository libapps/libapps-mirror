// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: saturation-value-picker
 *
 * @suppress {moduleLoad}
 */
import {LitElement, css, html} from './lit_element.js';

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
          border-radius: 100%;
          border: 3px solid white;
          box-shadow: 0 0 0 1px #5F6368;
          box-sizing: border-box;
          cursor: pointer;
          height: 32px;
          left: 50%;
          pointer-events: none;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 32px;
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
        <div id="picker" style="${pickerStyle}"></div>
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
    this.update_(event);
  }

  /** @param {!Event} event */
  onPointerMove_(event) {
    this.update_(event);
  }

  /** @param {!Event} event */
  onPointerUp_(event) {
    this.removeEventListener('pointermove', this.onPointerMove_);
    this.releasePointerCapture(event.pointerId);
    this.update_(event);
  }

  /** @param {!Event} event */
  update_(event) {
    const xPercent = lib.f.clamp(event.offsetX / this.clientWidth, 0, 1);
    const yPercent = lib.f.clamp(event.offsetY / this.clientHeight, 0, 1);

    this.saturation = 100 * xPercent;
    this.value = 100 * (1 - yPercent);

    this.dispatchEvent(new CustomEvent('updated', {bubbles: true}));
  }
}

customElements.define(SaturationValuePickerElement.is,
    SaturationValuePickerElement);
