// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: transparency-slider
 *
 * @suppress {moduleLoad}
 */

import {lib} from '../../libdot/index.js';

import {LitElement, css, html} from './lit.js';
import {redispatchEvent} from './terminal_common.js';
import './terminal_knob.js';
import './terminal_slider.js';

const setAlpha = lib.colors.setAlpha;

export class TransparencySliderElement extends LitElement {
  static get is() { return 'transparency-slider'; }

  /** @override */
  static get properties() {
    return {
      color: {
        type: String,
      },
      transparency: {
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
          display: block;
          width: 200px;
        }

        #display {
          border-radius: 4px;
          height: 100%;
          pointer-events: none;
          width: 100%;
        }
    `;
  }

  /** @override */
  render() {
    const color = lib.notNull(lib.colors.normalizeCSS(
        this.color || 'rgb(0, 0, 0)'));
    const displayStyle = `background-image: linear-gradient(to right, ` +
        `transparent, ${setAlpha(color, 1)});`;
    return html`
        <terminal-slider value=${this.transparency} @change=${this.onChange_}>
          <div id="display" style="${displayStyle}"></div>
          <terminal-knob slot="knob"
              style="background-color: ${setAlpha(color, this.transparency)};">
          </terminal-knob>
        </terminal-slider>
    `;
  }

  constructor() {
    super();

    /** @public {string} */
    this.color;
    /** @private {number} */
    this.transparency = 0;
    /** @private {?Element} */
    this.slider_;
  }

  /** @override */
  firstUpdated() {
    this.slider_ = this.shadowRoot.querySelector('terminal-slider');
  }

  onChange_(event) {
    this.transparency = this.slider_.value;
    redispatchEvent(this, event);
  }

}
customElements.define(TransparencySliderElement.is, TransparencySliderElement);
