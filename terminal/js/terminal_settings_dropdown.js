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
 * This is equivalent to |value ?? fallback|, which closure-compiler does not
 * support yet.
 *
 * @param {*} value
 * @param {*} fallback
 * @return {*} value ?? fallback
 */
function nullishCoalescing(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }
  return value;
}

/**
 * If |label| is nullish, |value| is used as the label.
 *
 * @typedef {{
 *            value: *,
 *            label: ?string,
 *            style: ?string,
 *            disabled: ?boolean,
 *          }}
 */
let OptionType;

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
      // Array of |OptionType| objects.
      options: {
        type: Array,
        attribute: false,
      },
      value: {
        attribute: false,
      },
    };
  }

  /** @override */
  static get styles() {
    return css`
        :host {
          line-height: 32px;
          outline: none;
        }

        #container {
          background-color: rgb(241, 243, 244);
          border-radius: 6px;
          color: #202124;
          cursor: pointer;
          min-width: 40px;
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

        #current-value[data-disabled], .option[disabled] {
          opacity: .38;
        }

        .option[aria-selected="true"] {
          background-color: rgb(232, 240, 254);
        }

        .option:not([disabled]):hover {
          background-color: lightgrey;
        }
    `;
  }

  constructor() {
    super();

    this.expanded = false;
    /** @public {!Array<!OptionType>} */
    this.options = [];
  }

  /** @override */
  render() {
    const selectedIndex = this.findSelectedIndex_();

    const renderOption = (option, index) => html`
        <li class="option" role="option" tab-index="-1"
            aria-selected="${index === selectedIndex}"
            style="${nullishCoalescing(option.style, '')}"
            ?disabled="${option.disabled === true}"
            @click="${this.onItemClickedHandler_(index)}">
          ${nullishCoalescing(option.label, option.value)}
        </li>
    `;

    let selectedLabel = '';
    let selectedDisabled = false;
    if (selectedIndex !== -1) {
      const option = this.options[selectedIndex];
      selectedLabel = nullishCoalescing(option.label, option.value);
      selectedDisabled = option.disabled === true;
    }
    return html`
        <div id="container" role="button" aria-expanded="${this.expanded}" >
          <div id="current-value" ?data-disabled="${selectedDisabled}">
            ${selectedLabel}
          </div>
          <ul id="options" role="listbox">
            ${this.options.map(renderOption)}
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

  /**
   * Select the first enabled option from |options|.
   *
   * @param {!Array<!OptionType>} options
   * @return {boolean} True if an option is selected.
   */
  selectFirstEnabled_(options) {
    for (const option of options) {
      if (option.disabled !== true) {
        this.uiChanged_(option.value);
        return true;
      }
    }
    return false;
  }

  /**
   * @return {number} Return the index of the currently selected option, or -1
   *     if none are selected.
   */
  findSelectedIndex_() {
    return this.options.findIndex((option) => option.value === this.value);
  }

  selectPrevious_() {
    const selected = this.findSelectedIndex_();
    if (selected != -1) {
      return this.selectFirstEnabled_(
          this.options.slice(0, selected).reverse());
    }
  }

  selectNext_() {
    const selected = this.findSelectedIndex_();
    if (selected != -1) {
      return this.selectFirstEnabled_(this.options.slice(selected + 1));
    }
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
        preventDefault = this.selectFirstEnabled_(this.options);
        break;
      case 'PageDown':
      case 'End':
        preventDefault = this.selectFirstEnabled_(
            this.options.slice().reverse());
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
   * Return a click event handler for a option <li> element.
   *
   * @param {number} index The index of the option.
   * @return {function(!Event)}
   */
  onItemClickedHandler_(index) {
    return (event) => {
      const option = this.options[index];
      if (option.disabled !== true) {
        this.uiChanged_(option.value);
        this.expanded = false;
      }
      event.stopPropagation();
    };
  }
}

customElements.define(TerminalSettingsDropdownElement.is,
    TerminalSettingsDropdownElement);
