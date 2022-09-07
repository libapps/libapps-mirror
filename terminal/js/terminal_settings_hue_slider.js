// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: hue-slider
 *
 * @suppress {moduleLoad}
 */
import {LitElement, css, html} from './lit.js';
import {redispatchEvent} from './terminal_common.js';
import './terminal_knob.js';
import './terminal_slider.js';

export class HueSliderElement extends LitElement {
  static get is() { return 'hue-slider'; }

  /** @override */
  static get properties() {
    return {
      hue: {
        type: Number,
        reflect: true,
      },
    };
  }

  /** @override */
  static get styles() {
    return css`
        :host {
          background-image: linear-gradient(
              to right,
              rgba(255, 0, 0, 1),
              rgba(255, 255, 0, 1),
              rgba(0, 255, 0, 1),
              rgba(0, 255, 255, 1),
              rgba(0, 0, 255, 1),
              rgba(255, 0, 255, 1),
              rgba(255, 0, 0, 1));
          border-radius: 4px;
          cursor: pointer;
          display: block;
          height: 16px;
          position: relative;
          width: 200px;
        }
    `;
  }

  /** @override */
  render() {
    return html`
        <terminal-slider value=${this.hue / 360} @change="${this.onChange_}">
          <terminal-knob slot="knob"
              style="background-color: hsl(${this.hue}, 100%, 50%);">
          </terminal-knob>
        </terminal-slider>
    `;
  }

  constructor() {
    super();

    /** @public {number} */
    this.hue;
    /** @private {?Element} */
    this.slider_;
  }

  /** @override */
  firstUpdated() {
    this.slider_ = this.shadowRoot.querySelector('terminal-slider');
  }

  onChange_(event) {
    this.hue = this.slider_.value * 360;
    redispatchEvent(this, event);
  }
}

customElements.define(HueSliderElement.is, HueSliderElement);
