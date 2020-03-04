// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-colorpicker.
 *
 * @suppress {moduleLoad}
 */
import {css, html} from './lit_element.js';
import {TerminalSettingsElement} from './terminal_settings_element.js';

/**
 * Convert CSS color to hex color.
 *
 * @param {string} css
 * @return {string} hex color
 */
function cssToHex(css) {
  return lib.notNull(
      lib.colors.rgbToHex(lib.notNull(lib.colors.normalizeCSS(css))));
}

export class TerminalSettingsColorpickerElement extends
    TerminalSettingsElement {
  static get is() { return 'terminal-settings-colorpicker'; }

  /** @override */
  static get properties() {
    return {
      preference: {
        type: String,
      },
      value: {
        type: String,
        reflect: true,
      },
      disableTransparency: {
        type: Boolean,
      },
      hue_: {
        type: Number
      },
      saturation_: {
        type: Number
      },
      lightness_: {
        type: Number
      },
      transparency_: {
        type: Number
      },
    };
  }

  /** @override */
  static get styles() {
    return css`
        #smallview {
          align-items: center;
          display: flex;
          flex-wrap: nowrap;
          justify-content: space-between;
          min-width: 200px;
          padding: 4px;
        }

        #swatch {
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
          border-radius: 100%;
          box-shadow: 1px 1px 2px rgba(0,0,0,0.3);
          cursor: pointer;
          display: inline-block;
          height: 30px;
          margin: 4px;
          position: relative;
          user-select: none;
          width: 30px;
        }

        #swatchdisplay {
          border-radius: inherit;
          height: 100%;
          pointer-events: none;
          width: 100%;
        }

        #hexinput {
          background-color: lightgrey;
          border-radius: 4px;
          border: none;
          box-shadow: 1px 1px 2px rgba(0,0,0,0.3);
          margin: 4px;
          padding: 5px;
          width: 17ch;
        }

        dialog {
          border: 0;
          border-radius: 8px;
          box-shadow: 0 0 16px rgba(0, 0, 0, 0.12),
                      0 16px 16px rgba(0, 0, 0, 0.24);
        }

        #dialog-content {
          padding: 30px;
        }

        hue-slider, transparency-slider {
          margin-top: 20px;
        }
    `;
  }

  /** @override */
  render() {
    return html`
        <div id="smallview">
          <div id="swatch" @click="${this.onSwatchClick_}">
            <div id="swatchdisplay" style="background-color: ${this.value}">
            </div>
          </div>
          <input id="hexinput" type="text"
              .value="${cssToHex(/** @type {string} */(this.value))}"
              @blur="${this.onInputBlur_}"/>
        </div>
        <dialog @click=${this.onDialogClick_}>
          <div id="dialog-content">
            <saturation-lightness-picker
                @updated="${this.onSaturationLightness_}"
                hue="${this.hue_}" saturation="${this.saturation_}"
                lightness="${this.lightness_}">
            </saturation-lightness-picker>
            <hue-slider hue="${this.hue_}" @updated="${this.onHue_}" >
            </hue-slider>
            ${this.disableTransparency
                ? ''
                : html`<transparency-slider hue="${this.hue_}"
                           @updated="${this.onTransparency_}"
                           transparency="${this.transparency_}">
                       </transparency-slider>`
            }
          </div>
        </dialog>
    `;
  }

  constructor() {
    super();

    this.disableTransparency = false;
    /** @private {number} */
    this.hue_;
    /** @private {number} */
    this.saturation_;
    /** @private {number} */
    this.lightness_;
    /** @private {number} */
    this.transparency_;
  }

  onUiChanged_() {
    super.uiChanged_(lib.colors.arrayToHSLA([this.hue_, this.saturation_,
          this.lightness_, this.transparency_]));
  }

  /** @override */
  preferenceChanged_(value) {
    super.preferenceChanged_(value);
    const hsl = lib.notNull(lib.colors.normalizeCSSToHSL(
        /** @type {string} */(value)));

    const [h, s, l, a] = lib.notNull(lib.colors.crackHSL(hsl)).map(
        Number.parseFloat);
    // Only update the preferences if they have changed noticably, as minor
    // updates due to rounding can move the picker around by small perceptible
    // amounts when clicking the same spot.
    if (Math.round(this.hue_) !== Math.round(h)) {
      this.hue_ = h;
    }
    if (Math.round(this.saturation_) !== Math.round(s)) {
      this.saturation_ = s;
    }
    if (Math.round(this.lightness_) !== Math.round(l)) {
      this.lightness_ = l;
    }
    this.transparency_ = a;
  }

  /** @param {!Event} event */
  onSwatchClick_(event) {
    this.shadowRoot.querySelector('dialog').showModal();
  }

  /**
   * Detects clicks on the dialog backdrop to close the dialog.
   *
   * @param {!Event} event
   */
  onDialogClick_(event) {
    // The visible dialog is filled by <div id="#dialog-content">,
    // so any click on target 'DIALOG', is on the backdrop.
    if (event.target.tagName === 'DIALOG') {
      event.target.close();
    }
  }

  /** @param {!Event} event */
  onSaturationLightness_(event) {
    this.saturation_ = event.target.saturation;
    this.lightness_ = event.target.lightness;
    this.onUiChanged_();
  }

  /** @param {!Event} event */
  onHue_(event) {
    this.hue_ = event.target.hue;
    this.onUiChanged_();
  }

  /** @param {!Event} event */
  onTransparency_(event) {
    this.transparency_ = event.target.transparency;
    this.onUiChanged_();
  }

  /** @param {!Event} event */
  onInputBlur_(event) {
    const rgb = lib.colors.normalizeCSS(event.target.value);
    if (!rgb) {
      event.target.value = cssToHex(/** @type {string} */(this.value));
    } else {
      super.uiChanged_(rgb);
    }
  }
}

customElements.define(TerminalSettingsColorpickerElement.is,
    TerminalSettingsColorpickerElement);
