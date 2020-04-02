// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: saturation-lightness-picker
 *
 * @suppress {moduleLoad}
 */
import {LitElement, css, html} from './lit_element.js';

export class SaturationLightnessPickerElement extends LitElement {
  static get is() { return 'saturation-lightness-picker'; }

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
      lightness: {
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

        :host::before {
          background-image: linear-gradient(
              to right,
              hsl(0, 0%, 50%),
              transparent);
          bottom: 0;
          content: "";
          left: 0;
          pointer-events: none;
          position: absolute;
          right: 0;
          top: 0;
          z-index: 1;
        }

        :host::after {
          background-image: linear-gradient(
              to top,
              black,
              transparent,
              white);
          bottom: 0;
          content: "";
          left: 0;
          pointer-events: none;
          position: absolute;
          right: 0;
          top: 0;
          z-index: 1;
        }

        #display {
          border-radius: inherit;
          height: 100%;
          pointer-events: none;
          width: 100%;
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
    `;
  }

  /** @override */
  render() {
    return html`
        <div id="display" style="background-color:
            hsl(${this.hue}, 100%, 50%);">
        </div>
        <div id="picker" style="left: ${this.saturation}%;
            top: ${100 - this.lightness}%; background-color:
            hsl(${this.hue}, ${this.saturation}%, ${this.lightness}%);">
        </div>
    `;
  }

  constructor() {
    super();

    /** @private {number} */
    this.hue;
    /** @private {number} */
    this.saturation;
    /** @private {number} */
    this.lightness;
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
    this.lightness = 100 * (1 - yPercent);

    this.dispatchEvent(new CustomEvent('updated', {bubbles: true}));
  }
}

customElements.define(SaturationLightnessPickerElement.is,
    SaturationLightnessPickerElement);
