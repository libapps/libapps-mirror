// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-dropdown.
 *
 * @suppress {moduleLoad}
 */
import {css, html, LitElement} from './lit.js';

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

// A dropdown element. The a11y behavior follows
// https://www.w3.org/TR/wai-aria-practices-1.1/examples/listbox/listbox-collapsible.html.
export class TerminalDropdownElement extends LitElement {
  /** @override */
  static get properties() {
    return {
      expanded: {
        type: Boolean,
        reflect: true,
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
          display: block;
          line-height: 32px;
          outline: none;
          position: relative;
        }

        button {
          background-color: rgb(241, 243, 244);
          border: none;
          border-radius: 6px;
          color: var(--cr-primary-text-color);
          cursor: pointer;
          min-width: 40px;
          outline: none;
          padding: 9px 32px 9px 8px;
          text-align: left;
          width: 100%;
        }

        button:focus-visible {
          box-shadow: 0 0 0 2px var(--focus-shadow-color);
        }

        button[data-invalid] {
          color: var(--google-grey-600);
        }

        button:after {
          /* Set color to avoid being affected by button's invalid styling */
          color: var(--cr-primary-text-color);
          content: "⯆";
          position: absolute;
          right: 9px;
          top: 50%;
          transform: translateY(-50%);
        }

        :host([expanded]) button:after {
          content: "⯅";
        }

        ul {
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

        :host([expanded]) ul {
          display: initial;
        }

        li {
          cursor: pointer;
          padding: 1px 9px;
        }

        li[disabled] {
          opacity: .38;
        }

        li[aria-selected="true"] {
          background-color: rgb(232, 240, 254);
        }

        li:not([disabled]):hover {
          background-color: lightgrey;
        }
    `;
  }

  constructor() {
    super();

    /** @public {*} */
    this.value;
    this.expanded = false;
    /** @public {!Array<!OptionType>} */
    this.options = [];
  }

  /** @override */
  render() {
    const selectedIndex = this.findSelectedIndex_();

    const renderOption = (option, index) => html`
        <li id="option-${index}"
            role="option"
            aria-selected="${index === selectedIndex}"
            style="${option.style ?? ''}"
            ?disabled="${option.disabled === true}"
            @click="${this.onItemClickedHandler_(index)}">
          ${option.label ?? option.value}
        </li>
    `;

    let selectedLabel;
    let selectedInvalid;
    if (selectedIndex !== -1) {
      const option = this.options[selectedIndex];
      selectedLabel = option.label ?? option.value;
      selectedInvalid = option.disabled === true;
    } else {
      selectedLabel = `${this.value}`;
      selectedInvalid = true;
    }

    // We listen to "mousedown" instead of "click" on the button element because
    // if the <ul> is expanded and focused, "click" will be fired after the <ul>
    // received a "blur" event. The "blur" event sets `this.expanded = false`,
    // and the "click" event will then incorrectly toggle it to true again.
    return html`
        <button
            aria-haspopup="listbox"
            aria-expanded="${this.expanded}"
            ?data-invalid="${selectedInvalid}"
            @keydown="${this.onButtonKeyDown_}"
            @mousedown="${this.onButtonMouseDown_}">
          ${selectedLabel}
        </button>
        <ul
            tabindex="-1"
            role="listbox"
            aria-activedescendant="option-${selectedIndex}"
            @keydown="${this.onUlKeyDown_}"
            @blur=${() => this.expanded = false}>
          ${this.options.map(renderOption)}
        </ul>
    `;
  }

  /** @override */
  updated(changedProperties) {
    if (changedProperties.has('expanded') && this.expanded) {
      // Focus the <ul> when it is expaned. We use `setTimeout()` here.
      // Otherwise mousedown on the button does not expand the dropdown because
      // of some race condition.
      setTimeout(() => this.shadowRoot.querySelector('ul').focus());
    }
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
        this.value = option.value;
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
    // Use == instead of === so that a preference supplying a string-typed
    // this.value can match an integer typed option.value.
    return this.options.findIndex((option) => option.value == this.value);
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
  onButtonMouseDown_(event) {
    this.expanded = !this.expanded;
  }

  /** @param {!Event} event */
  onButtonKeyDown_(event) {
    switch (event.code) {
      case 'Enter':
      case 'Space':
        this.expanded = !this.expanded;
        break;
      case 'PageUp':
      case 'Home':
      case 'PageDown':
      case 'End':
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'ArrowRight':
      case 'ArrowDown':
        this.expanded = true;
        this.onUlKeyDown_(event);
        break;
    }
  }

  /** @param {!Event} event */
  onUlKeyDown_(event) {
    let preventDefault = false;
    switch (event.code) {
      case 'Enter':
      case 'Space':
      case 'Escape':
        this.expanded = false;
        this.shadowRoot.querySelector('button').focus();
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
        this.value = option.value;
        this.expanded = false;
        this.shadowRoot.querySelector('button').focus();
      }
      event.stopPropagation();
    };
  }
}

customElements.define('terminal-dropdown', TerminalDropdownElement);


// TODO: The logic here is pretty much a duplicate of `TerminalSettingsElement`,
// but we cannot inherit it because JS does not support multi-inheritance. Maybe
// we should extract the logic to a mixin and replace `TerminalSettingsElement`
// with it.
export class TerminalSettingsDropdownElement extends TerminalDropdownElement {
  /** @override */
  static get properties() {
    return {
      preference: {
        type: String,
      },
    };
  }

  constructor() {
    super();

    /** @public {string} */
    this.preference = '';

    this.onPrefChanged_ = (value) => this.value = value;
  }

  /** @override */
  connectedCallback() {
    super.connectedCallback();

    this.onPrefChanged_(
        window.preferenceManager.get(this.preference));
    window.preferenceManager.addObserver(
        this.preference,
        this.onPrefChanged_);
  }

  /** @override */
  disconnectedCallback() {
    super.disconnectedCallback();

    window.preferenceManager.removeObserver(
        this.preference,
        this.onPrefChanged_);
  }

  /** @override */
  updated(changedProperties) {
    super.updated(changedProperties);

    if (changedProperties.has('value')) {
      window.preferenceManager.set(this.preference, this.value);
    }
  }
}

customElements.define('terminal-settings-dropdown',
    TerminalSettingsDropdownElement);
