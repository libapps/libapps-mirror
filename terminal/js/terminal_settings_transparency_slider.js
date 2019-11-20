// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: transparency-slider
 *
 * @suppress {moduleLoad}
 */
import {LitElement, css, html} from './lit_element.js';

export class TransparencySliderElement extends LitElement {
  static get is() { return 'transparency-slider'; }

  /** @override */
  static get properties() {
    return {
      transparency: {
        type: Number,
        reflect: true,
      },
      hue: {
        type: Number,
      },
    };
  }

  /** @override */
  static get styles() {
    return css`
        :host {
          background-image: linear-gradient(
              45deg,
              rgba(0,0,0,0.1) 25%,
              transparent 25%,
              transparent 75%,
              rgba(0,0,0,0.1) 75%,
              rgba(0,0,0,0.1) 0), linear-gradient(
              45deg,
              rgba(0,0,0,0.1) 25%,
              transparent 25%,
              transparent 75%,
              rgba(0,0,0,0.1) 75%,
              rgba(0,0,0,0.1) 0);
          background-position: 0px 0, 5px 5px;
          background-size: 10px 10px, 10px 10px;
          border-radius: 4px;
          box-shadow: 1px 1px 2px rgba(0,0,0,0.3);
          cursor: pointer;
          display: block;
          height: 12px;
          position: relative;
          width: 200px;
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
        <div id="display" style="background-image: linear-gradient(to right,
            transparent, hsl(${this.hue}, 100%, 50%));">
        </div>
        <div id="picker" style="left: ${100 * this.transparency}%;
            background-color: hsl(${this.hue}, 100%, 50%);">
        </div>
    `;
  }

  constructor() {
    super();

    /** @private {number} */
    this.hue;
    /** @private {number} */
    this.transparency;
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

    this.transparency = xPercent;

    this.dispatchEvent(new CustomEvent('updated', {bubbles: true}));
  }
}

customElements.define(TransparencySliderElement.is, TransparencySliderElement);
