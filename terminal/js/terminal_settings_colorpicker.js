// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-colorpicker.
 *
 * @suppress {moduleLoad}
 */
import {LitElement, css, html} from './lit_element.js';
import {TerminalSettingsElement} from './terminal_settings_element.js';
import {stylesButtonContainer} from './terminal_settings_styles.js';
import './terminal_settings_button.js';

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

export class TerminalColorpickerElement extends LitElement {
  static get is() { return 'terminal-colorpicker'; }

  /** @override */
  static get properties() {
    return {
      value: {
        type: String,
        reflect: true,
      },
      inputInDialog: {
        type: Boolean,
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
    return [stylesButtonContainer, css`
        #smallview {
          align-items: center;
          display: flex;
          flex-wrap: nowrap;
          justify-content: space-between;
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
          padding: 8px;
        }

        hue-slider, transparency-slider, dialog #hexinput {
          margin-top: 20px;
        }
    `];
  }

  /** @override */
  render() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);
    const transparency = this.disableTransparency ? '' : html`
        <transparency-slider hue="${this.hue_}"
            @updated="${this.onTransparency_}"
            transparency="${this.transparency_}">
        </transparency-slider>`;
    const input = html`
        <input id="hexinput" type="text"
            .value="${cssToHex(/** @type {string} */(this.value))}"
            @blur="${this.onInputBlur_}"
            @keyup="${this.onInputKeyup_}"/>`;
    return html`
        <div id="smallview">
          <div id="swatch" @click="${this.onSwatchClick_}">
            <div id="swatchdisplay" style="background-color: ${this.value}">
            </div>
          </div>
          ${this.inputInDialog ? '' : input}
        </div>
        <dialog>
          <div id="dialog-content">
            <saturation-lightness-picker
                @updated="${this.onSaturationLightness_}"
                hue="${this.hue_}" saturation="${this.saturation_}"
                lightness="${this.lightness_}">
            </saturation-lightness-picker>
            <hue-slider hue="${this.hue_}" @updated="${this.onHue_}" >
            </hue-slider>
            ${transparency}
            ${this.inputInDialog ? input : ''}
            <div class="button-container">
              <terminal-settings-button class="cancel"
                  @click="${this.onCancelClick_}">
                ${msg('CANCEL_BUTTON_LABEL')}
              </terminal-settings-button>
              <terminal-settings-button class="action"
                  @click="${this.onOkClick_}">
                ${msg('OK_BUTTON_LABEL')}
              </terminal-settings-button>
            </div>
          </div>
        </dialog>
    `;
  }

  constructor() {
    super();

    /** If true, hex input is shown in dialog rather than next to swatch. */
    this.inputInDialog = false;
    /** If true, transparency is not shown. */
    this.disableTransparency = false;
    /** @private {string} */
    this.value_;
    /** @private {number} */
    this.hue_;
    /** @private {number} */
    this.saturation_;
    /** @private {number} */
    this.lightness_;
    /** @private {number} */
    this.transparency_;
    /** @private {string} */
    this.cancelValue_;
  }

  /**
   * UI changed and we should update value with rgb provided, or
   * recalculate value from hslt components.
   *
   * @param {string=} rgb New RGB value from hex input.
   * @private
   */
  onUiChanged_(rgb) {
    if (rgb !== undefined) {
      this.value = rgb;
    } else {
      this.value = lib.colors.arrayToHSLA([this.hue_, this.saturation_,
            this.lightness_, this.transparency_]);
    }
    this.dispatchEvent(new CustomEvent('updated'));
  }

  /** @param {string} value */
  set value(value) {
    if (value === this.value_) {
      return;
    }
    const oldValue = this.value_;
    this.value_ = value;
    const hsl = lib.notNull(lib.colors.normalizeCSSToHSL(value));
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
    this.requestUpdate('value', oldValue);
  }

  /** @return {string} */
  get value() {
    return this.value_;
  }

  /** @param {!Event} event */
  onSwatchClick_(event) {
    this.shadowRoot.querySelector('dialog').showModal();
    this.cancelValue_ = this.value;
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
      this.onUiChanged_(rgb);
    }
  }

  /** @param {!KeyboardEvent} event */
  onInputKeyup_(event) {
    if (event.key === 'Enter') {
      this.onInputBlur_(event);
      this.onOkClick_(event);
    }
  }

  /**
   * Detects clicks on the dialog cancel button.
   *
   * @param {!Event} event
   */
  onCancelClick_(event) {
    this.shadowRoot.querySelector('dialog').close();
    this.onUiChanged_(this.cancelValue_);
  }

  /**
   * Detects clicks on the dialog cancel button.
   *
   * @param {!Event} event
   */
  onOkClick_(event) {
    this.shadowRoot.querySelector('dialog').close();
  }
}

customElements.define(TerminalColorpickerElement.is,
    TerminalColorpickerElement);

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
      }
    };
  }

  /** @override */
  render() {
    return html`
        <terminal-colorpicker @updated="${this.onUpdated_}"
            value="${this.value}"
            ?disableTransparency="${this.disableTransparency}"/>
    `;
  }

  constructor() {
    super();

    /** If true, transparency is not shown. */
    this.disableTransparency = false;
  }

  /**
   * Handle 'updated' event when one of the colors changes.
   *
   * @param {!CustomEvent} event Event with index and value.
   * @private
   */
  onUpdated_(event) {
    super.uiChanged_(event.target.value);
  }
}

customElements.define(TerminalSettingsColorpickerElement.is,
    TerminalSettingsColorpickerElement);
