// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-colorpicker.
 *
 * @suppress {moduleLoad}
 */

import {lib} from '../../libdot/index.js';

import {LitElement, css, html, ifDefined} from './lit.js';
import {CHROME_VERSION} from './terminal_common.js';
import {TerminalSettingsElement} from './terminal_settings_element.js';
import './terminal_button.js';
import './terminal_settings_hue_slider.js';
import './terminal_settings_saturation_value_picker.js';
import './terminal_settings_transparency_slider.js';
import './terminal_textfield.js';
import './terminal_dialog.js';

// Export for testing.
export const TOO_WHITE_BOX_SHADOW = 'inset 0 0 0 1px black';
export const TOO_BLACK_BOX_SHADOW = 'inset 0 0 0 1px white';
export const FOCUS_BOX_SHADOW =
    '0 0 0 2px var(--cros-color-prominent)';

/**
 * Convert CSS color to hex color.  Always use uppercase for display.
 *
 * @param {string} css
 * @return {string} hex color
 */
function cssToHex(css) {
  return lib.notNull(lib.colors.rgbToHex(
      lib.notNull(lib.colors.normalizeCSS(css)))).toUpperCase();
}

/**
 * Return a css string for the swatch's style attribute.
 *
 * @param {string} color the css color.
 * @param {boolean} showFocusRing
 * @return {string}
 */
function swatchStyle(color, showFocusRing) {
  const boxShadows = [];

  if (color) {
    const c = lib.colors;
    const contrastRatio = c.contrastRatio(1, c.luminance(
        ...lib.notNull(c.crackRGB(lib.notNull(c.normalizeCSS(color))))));
    const darkMode = window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (!darkMode && contrastRatio < 1.25) {
      // The color is too white. Put a "border" to make it stands out from the
      // background.
      boxShadows.push(TOO_WHITE_BOX_SHADOW);
    } else if (darkMode && contrastRatio > 8) {
      boxShadows.push(TOO_BLACK_BOX_SHADOW);
    }
  }

  if (showFocusRing) {
    boxShadows.push(FOCUS_BOX_SHADOW);
  }

  return `background-color: ${color}; box-shadow: ${boxShadows.join(',')}`;
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
      ariaLabel: {
        type: String,
      },
      inputInDialog: {
        type: Boolean,
      },
      disableTransparency: {
        type: Boolean,
      },
      hue_: {
        type: Number,
      },
      saturation_: {
        type: Number,
      },
      hsvValue_: {
        type: Number,
      },
      transparency_: {
        type: Number,
      },
      dialogIsOpened_: {
        type: Boolean,
      },
      swatchFocusVisible_: {
        type: Boolean,
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
        }

        #swatch {
          background-image: linear-gradient(
              45deg,
              var(--cros-selection-outline) 25%,
              transparent 25%,
              transparent 75%,
              var(--cros-selection-outline) 75%,
              var(--cros-selection-outline) 0), linear-gradient(
              45deg,
              rgba(0,0,0,0.1) 25%,
              transparent 25%,
              transparent 75%,
              var(--cros-selection-outline) 75%,
              var(--cros-selection-outline) 0);
          background-position: 0px 0, 5px 5px;
          background-size: 10px 10px, 10px 10px;
          border-radius: 50%;
          cursor: pointer;
          display: inline-block;
          height: 24px;
          margin: 6px;
          outline: none;
          position: relative;
          user-select: none;
          width: 24px;
        }

        #swatchdisplay {
          border-radius: inherit;
          height: 100%;
          pointer-events: none;
          width: 100%;
        }

        #hexinput {
          margin-left: 6px;
          width: 140px;
          --terminal-textfield-text-transform: uppercase;
        }

        hue-slider, transparency-slider {
          margin: 24px 0;
        }

        terminal-dialog #hexinput {
          margin: 0;
        }

        terminal-dialog {
          --terminal-dialog-overflow: hidden;
        }
    `;
  }

  /** @override */
  render() {
    const transparency = this.disableTransparency ? '' : html`
        <transparency-slider color="${this.value}"
            transparency="${this.transparency_}"
            @change="${this.onTransparency_}">
        </transparency-slider>`;
    const input = html`
        <terminal-textfield id="hexinput"
            .value="${cssToHex(/** @type {string} */(this.value))}"
            ariaLabel="${ifDefined(this.ariaLabel)}"
            @change="${this.onInputChange_}"
            @keydown="${this.onInputKeydown_}"/>`;
    return html`
        <div id="smallview">
          <div id="swatch" tabindex="0"
              aria-label="${ifDefined(this.ariaLabel)}"
              @blur="${this.onSwatchBlur_}"
              @click="${this.onSwatchActivated_}"
              @focus="${this.onSwatchFocus_}"
              @keydown="${this.onSwatchKeydown_}"
          >
            <div id="swatchdisplay"
                style="${swatchStyle(this.value,
                    this.dialogIsOpened_ || this.swatchFocusVisible_)}">
            </div>
          </div>
          ${this.inputInDialog ? '' : input}
        </div>
        <terminal-dialog @close="${this.onDialogClose_}">
          <saturation-value-picker
              @change="${this.onSaturationValue_}"
              hue="${this.hue_}" saturation="${this.saturation_}"
              value="${this.hsvValue_}">
          </saturation-value-picker>
          <hue-slider hue="${this.hue_}" @change="${this.onHue_}"></hue-slider>
          ${transparency}
          ${this.inputInDialog ? input : ''}
        </terminal-dialog>
    `;
  }

  onSwatchFocus_(event) {
    this.swatchFocusVisible_ = event.target.matches(
        CHROME_VERSION >= 87 ? ':focus-visible' : ':focus');
  }

  onSwatchBlur_(event) {
    this.swatchFocusVisible_ = false;
  }

  onSwatchKeydown_(event) {
    switch (event.code) {
      case 'Enter':
      case 'Space':
        this.onSwatchActivated_();
        event.preventDefault();
        break;
    }
  }

  constructor() {
    super();

    this.ariaLabel = undefined;
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
    this.hsvValue_;
    /** @private {number} */
    this.transparency_;
    /** @private {string} */
    this.cancelValue_;
    /** @private {boolean} */
    this.dialogIsOpened_ = false;
    /** @private {boolean} */
    this.swatchFocusVisible_ = false;
  }

  /**
   * UI changed and we should update value with rgb provided, or
   * recalculate value from hslt components.
   *
   * @param {string=} value New value from hex input.
   * @private
   */
  onUiChanged_(value) {
    if (value !== undefined) {
      this.value = value;
    } else {
      const hslaArray = lib.colors.hsvxArrayToHslaArray([this.hue_,
          this.saturation_, this.hsvValue_, this.transparency_]);
      this.value = lib.colors.arrayToHSLA(hslaArray);
    }
    this.dispatchEvent(new CustomEvent('change'));
  }

  /** @param {string} value */
  set value(value) {
    if (value === this.value_) {
      return;
    }
    const oldValue = this.value_;
    this.value_ = value;
    const hsl = lib.notNull(lib.colors.normalizeCSSToHSL(value));
    const hslaArray = lib.notNull(lib.colors.crackHSL(hsl)).map(
        Number.parseFloat);
    const [h, s, v, a] = lib.colors.hslxArrayToHsvaArray(hslaArray);
    // Only update the preferences if they have changed noticably, as minor
    // updates due to rounding can move the picker around by small perceptible
    // amounts when clicking the same spot.
    if (Math.round(this.hue_) !== Math.round(h)) {
      this.hue_ = h;
    }
    if (Math.round(this.saturation_) !== Math.round(s)) {
      this.saturation_ = s;
    }
    if (Math.round(this.hsvValue_) !== Math.round(v)) {
      this.hsvValue_ = v;
    }
    this.transparency_ = a;
    this.requestUpdate('value', oldValue);
  }

  /** @return {string} */
  get value() {
    return this.value_;
  }

  onSwatchActivated_() {
    this.openDialog();
    this.cancelValue_ = this.value;
  }

  /** @param {!Event} event */
  onSaturationValue_(event) {
    this.saturation_ = event.target.saturation;
    this.hsvValue_ = event.target.value;
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
  onInputChange_(event) {
    const rgb = lib.colors.normalizeCSS(event.target.value);
    if (!rgb) {
      event.target.value = cssToHex(/** @type {string} */(this.value));
    } else {
      // Store uppercase hex to help detect when a value is set to default.
      this.onUiChanged_(cssToHex(event.target.value));
    }
  }

  /** @param {!KeyboardEvent} event */
  onInputKeydown_(event) {
    if (event.key === 'Enter') {
      this.onInputChange_(event);
      this.shadowRoot.querySelector('terminal-dialog').accept();
    }
  }

  /**
   * Handles dialog close.
   *
   * @param {!Event} event
   */
  onDialogClose_(event) {
    this.dialogIsOpened_ = false;
    if (!event.detail.accept) {
      this.onUiChanged_(this.cancelValue_);
    }
  }

  openDialog() {
    this.dialogIsOpened_ = true;
    this.shadowRoot.querySelector('terminal-dialog').show();
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
      ariaLabel: {
        type: String,
      },
      disableTransparency: {
        type: Boolean,
      },
    };
  }

  /** @override */
  render() {
    return html`
        <terminal-colorpicker @change="${this.scheduleUpdate_}"
            value="${this.value}"
            ariaLabel="${ifDefined(this.ariaLabel)}"
            ?disableTransparency="${this.disableTransparency}"/>
    `;
  }

  constructor() {
    super();

    this.ariaLabel = undefined;
    /** If true, transparency is not shown. */
    this.disableTransparency = false;
    /** @private {string} */
    this.pendingValue_ = '';
    /** @private {?Promise<void>} */
    this.pendingUpdate_ = null;
    /** @public {number} */
    this.updateDelay = 100;
  }

  /**
   * Schedule to update the preference (and thus also this.value). The reason
   * that we do not do the update immediately is to avoid flooding the
   * preference manager, in which case the user might see the color picker knob
   * jumping around by itself after dragging the knob quickly.
   *
   * @param {!CustomEvent} event Event with value.
   * @private
   */
  scheduleUpdate_(event) {
    this.pendingValue_ = event.target.value;
    if (this.pendingUpdate_ === null) {
      // We need to use a promise so that tests can wait on this.
      this.pendingUpdate_ = new Promise((resolve) => {
        setTimeout(() => {
          this.pendingUpdate_ = null;
          super.uiChanged_(this.pendingValue_);
          resolve();
        }, this.updateDelay);
      });
    }
  }
}

customElements.define(TerminalSettingsColorpickerElement.is,
    TerminalSettingsColorpickerElement);
