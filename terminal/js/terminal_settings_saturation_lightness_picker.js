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

  static get styles() {
    return css`
        :host {
          box-shadow: 1px 1px 2px rgba(0,0,0,0.3);
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
          border: 2px solid white;
          box-shadow: 1px 1px 2px;
          box-sizing: border-box;
          cursor: pointer;
          height: 24px;
          left: 50%;
          pointer-events: none;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 24px;
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

    this.addEventListener('click', this.onClick_);
  }

  /** @override */
  disconnectedCallback() {
    this.removeEventListener('click', this.onClick_);

    super.disconnectedCallback();
  }

  /** @param {!Event} event */
  onClick_(event) {
    const xPercent = lib.f.clamp(event.offsetX / this.clientWidth, 0, 1);
    const yPercent = lib.f.clamp(event.offsetY / this.clientHeight, 0, 1);

    this.saturation = 100 * xPercent;
    this.lightness = 100 * (1 - yPercent);

    this.dispatchEvent(new CustomEvent('updated', {bubbles: true}));
  }
}
