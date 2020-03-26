// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-dropdown.
 *
 * @suppress {moduleLoad}
 */
import {css, html} from './lit_element.js';
import {TerminalSettingsElement} from './terminal_settings_element.js';

/**
 * @param {*} value
 * @return {string}
 */
function trivialToText(value) {
  return `${value}`;
}

export class TerminalSettingsDropdownElement extends TerminalSettingsElement {
  static get is() { return 'terminal-settings-dropdown'; }

  /** @override */
  static get properties() {
    return {
      preference: {
        type: String,
      },
      expanded: {
        type: Boolean,
      },
      options: {
        type: Array,
        attribute: false,
      },
      value: {
        attribute: false,
      },
      toText: {
        attribute: false,
      },
    };
  }

  /** @override */
  static get styles() {
    return css`
        :host {
          outline: none;
        }

        #container {
          background-color: rgb(241, 243, 244);
          border-radius: 6px;
          color: #202124;
          cursor: pointer;
          min-width: 60px;
          padding: 0 32px 0 8px;
          position: relative;
          user-select: none;
        }

        #container:after {
          content: "⯆";
          position: absolute;
          right: 9px;
          top: 50%;
          transform: translateY(-50%);
        }

        #container[aria-expanded="true"]:after {
          content: "⯅";
        }

        #options {
          background-color: white;
          border-radius: 4px;
          box-shadow: 0 1px 2px 0 rgba(60, 64, 67, 0.3),
                      0 2px 6px 2px rgba(60, 64, 67, 0.15);
          box-sizing: border-box;
          display: none;
          left: 0;
          list-style: none;
          margin: 0;
          min-width: 100%;
          padding: 0;
          position: absolute;
          top: 100%;
          z-index: 1;
        }

        #container[aria-expanded="true"] > #options {
          display: initial;
        }

        .option {
          cursor: pointer;
          padding: 1px 9px;
        }

        .option[aria-selected="true"] {
          background-color: rgb(213, 229, 255);
        }

        .option:hover {
          background-color: lightgrey;
        }
    `;
  }

  constructor() {
    super();

    this.expanded = false;
    /** @public {?Array<*>} */
    this.options = null;
    /** @public {function(*): string} */
    this.toText = trivialToText;
  }

  /** @override */
  render() {
    const renderOption = (option, index) => html`
        <li class="option" role="option" tab-index="-1"
            data-index="${index}" aria-selected="${this.value === option}"
            @click="${this.onUiChanged_}" >
          ${this.toText(option)}
        </li>
    `;

    return html`
        <div id="container" role="button" aria-expanded="${this.expanded}" >
          ${this.toText(this.value)}
          <ul id="options" role="listbox">
            ${this.getOptions_().map(renderOption)}
          </ul>
        </div>
    `;
  }

  /** @override */
  connectedCallback() {
    super.connectedCallback();

    if (!this.hasAttribute('tabindex')) {
      this.tabIndex = 0;
    }

    this.addEventListener('blur', this.onBlur_);
    this.addEventListener('click', this.onClick_);
    this.addEventListener('keydown', this.onKeyDown_);
  }

  /** @override */
  disconnectedCallback() {
    super.disconnectedCallback();

    this.removeEventListener('blur', this.onBlur_);
    this.removeEventListener('click', this.onClick_);
    this.removeEventListener('keydown', this.onKeyDown_);
  }

  selectNth_(index) {
    const element = this.shadowRoot
        .querySelector(`.option[data-index="${index}"]`);
    if (element) {
      super.uiChanged_(this.getValueFromLiElement_(
          /** @type {!HTMLLIElement} */ (element)
      ));
      return true;
    } else {
      return false;
    }
  }

  selectFirst_() {
    return this.selectNth_(0);
  }

  selectLast_() {
    return this.selectNth_(this.shadowRoot
        .querySelectorAll(`.option`).length - 1);
  }

  selectPrevious_() {
    return this.selectNth_(+this.shadowRoot
        .querySelector(`.option[aria-selected="true"]`)
        .getAttribute('data-index') - 1);
  }

  selectNext_() {
    return this.selectNth_(+this.shadowRoot
        .querySelector(`.option[aria-selected="true"]`)
        .getAttribute('data-index') + 1);
  }

  /** @param {!Event} event */
  onBlur_(event) {
    this.expanded = false;
  }

  /** @param {!Event} event */
  onClick_(event) {
    this.expanded = !this.expanded;
  }

  /** @param {!Event} event */
  onKeyDown_(event) {
    let preventDefault = false;
    switch (event.code) {
      case 'Enter':
        this.expanded = !this.expanded;
        break;
      case 'Escape':
        this.expanded = false;
        break;
      case 'Space':
        this.expanded = true;
        break;
      case 'PageUp':
      case 'Home':
        preventDefault = this.selectFirst_();
        break;
      case 'PageDown':
      case 'End':
        preventDefault = this.selectLast_();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        preventDefault = this.selectPrevious_();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        preventDefault = this.selectNext_();
        break;
    }
    if (preventDefault) {
      event.preventDefault();
    }
  }

  /**
   * @private
   * @return {!Array<*>}
   */
  getOptions_() {
    if (Array.isArray(this.options)) {
      return this.options;
    } else {
      const preferenceType =
          window.PreferenceManager.defaultPreferences[this.preference].type;
      lib.assert(Array.isArray(preferenceType));
      return preferenceType;
    }
  }

  /**
   * @private
   * @param {!HTMLLIElement} liElement
   * @return {*}
   */
  getValueFromLiElement_(liElement) {
    return this.getOptions_()[+liElement.getAttribute('data-index')];
  }

  /** @param {!Event} event */
  onUiChanged_(event) {
    super.uiChanged_(this.getValueFromLiElement_(
        /** @type {!HTMLLIElement} */ (event.target)
    ));
  }
}

customElements.define(TerminalSettingsDropdownElement.is,
    TerminalSettingsDropdownElement);
