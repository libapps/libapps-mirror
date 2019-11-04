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
      },
      value: {
        type: String,
        reflect: true,
      },
    };
  }

  static get styles() {
    return css`
        #container {
          background-color: rgb(241, 243, 244);
          border-radius: 6px;
          cursor: pointer;
          padding: 1px 23px 1px 9px;
          position: relative;
          user-select: none;
          min-width: 134px;
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
          border-radius: 6px;
          border: 1px solid lightgrey;
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
    /** @public {!Array<string>} */
    this.options;
  }

  /** @override */
  render() {
    const options = this.options ||
        window.PreferenceManager.defaultPreferences[this.preference].type;

    const renderOption = (option, index) => html`
        <li class="option" roll="option" tab-index="-1" value="${option}"
            option-index="${index}" aria-selected="${this.value === option}"
            @click="${this.onUiChanged_}" >
          ${option}
        </ul>
    `;

    return html`
        <div id="container" @role="button" aria-expanded="${this.expanded}" >
          ${this.value}
          <ul id="options">
            ${options.map(renderOption)}
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
        .querySelector(`.option[option-index="${index}"]`);
    if (element) {
      super.uiChanged_(element.getAttribute('value'));
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
        .querySelector(`.option[value="${this.value}"]`)
        .getAttribute('option-index') - 1);
  }

  selectNext_() {
    return this.selectNth_(+this.shadowRoot
        .querySelector(`.option[value="${this.value}"]`)
        .getAttribute('option-index') + 1);
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

  /** @param {!Event} event */
  onUiChanged_(event) {
    super.uiChanged_(event.target.getAttribute('value'));
  }
}
