// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-dropdown.
 *
 * @suppress {moduleLoad}
 */

import {hterm} from '../../hterm/index.js';

import {LitElement, classMap, css, html, ifDefined, when} from './lit.js';
import {ICON_CANCEL} from './terminal_icons.js';

/**
 * If |label| is nullish, |value| is used as the label.
 *
 * @typedef {{
 *            value: *,
 *            label: ?string,
 *            style: ?string,
 *            disabled: ?boolean,
 *            deletable: ?boolean,
 *          }}
 */
let OptionType;

// A dropdown element. The a11y behavior follows
// https://www.w3.org/TR/wai-aria-practices-1.1/examples/listbox/listbox-collapsible.html.
//
// It supports deletable items, but it only emits a 'delete-item' event, and the
// user is responsible for actually deleting it and updating the `options`
// property.
export class TerminalDropdownElement extends LitElement {
  /** @override */
  static get properties() {
    return {
      ariaLabel: {
        type: String,
      },
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
      hoverDeleteButton_: {
        state: true,
      },
    };
  }

  /** @override */
  static get styles() {
    return css`
        :host {
          color: var(--cros-color-primary);
          display: block;
          line-height: 32px;
          outline: none;
          position: relative;
        }

        button {
          background-color: var(--cros-textfield-background-color);
          border: none;
          border-radius: 6px;
          cursor: pointer;
          min-width: 40px;
          outline: none;
          padding: 9px 32px 9px 8px;
          text-align: left;
          width: 100%;
        }

        button:focus-visible {
          box-shadow: 0 0 0 2px var(--cros-color-prominent);
        }

        button.invalid {
          color: var(--google-grey-600);
        }

        button:after {
          /* Set color to avoid being affected by button's invalid styling */
          color: var(--cros-color-primary);
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
          background-color: var(--cros-bg-color);
          border-radius: 4px;
          box-shadow: 0 1px 2px 0 var(--cros-shadow-color-key),
                      0 2px 6px 2px var(--cros-shadow-color-ambient);
          box-sizing: border-box;
          display: none;
          left: 0;
          list-style: none;
          margin: 0;
          padding: 0;
          position: absolute;
          top: 100%;
          width: 100%;
          z-index: 1;
        }

        :host([expanded]) ul {
          display: initial;
        }

        li {
          align-items: center;
          cursor: pointer;
          display: flex;
          padding: 1px 9px;
        }

        li.taller {
          line-height: 48px;
        }

        li > span {
          flex-grow: 1;
          overflow-x: hidden;
        }

        li[disabled] {
          opacity: .38;
        }

        li[aria-selected="true"] {
          background-color: var(--cros-highlight-color);
        }

        li.allow-hover-effect:hover {
          background-color: var(--cros-highlight-color-hover);
        }
    `;
  }

  constructor() {
    super();

    this.ariaLabel = undefined;
    /** @public {*} */
    this.value;
    this.expanded = false;
    /** @public {!Array<!OptionType>} */
    this.options = [];
    // This indicates whether the mouse is hovering over a delete button.
    this.hoverDeleteButton_ = false;

    // This keeps track of whether the focus is "within" the <ul> element (i.e.
    // the focus is on the <ul> or an element inside the <ul>). This is used to
    // prevent hiding the <ul> when the focus is moved within the <ul> instead
    // of moving to the outside.
    this.ulFocused_ = false;
    this.ulFocusedTaskScheduled_ = false;
  }

  /** @override */
  render() {
    const selectedIndex = this.findSelectedIndex_();
    const hasDeletable = this.options.some((option) => option.deletable);

    const renderOption = (option, index) => html`
        <li id="option-${index}"
            class="${classMap({
              // Use "taller" style if there is an deletable item so that the
              // height is consistent.
              'taller': hasDeletable,
              'allow-hover-effect': !option.disabled &&
                  !this.hoverDeleteButton_,
            })}"
            role="option"
            aria-selected="${index === selectedIndex}"
            style="${option.style ?? ''}"
            ?disabled="${option.disabled}"
            @click="${this.onItemClickedHandler_(index)}">
          <span>${option.label ?? option.value}</span>
          ${when(option.deletable, () => this.renderDeleteButton_(index))}
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
            aria-label="${ifDefined(this.ariaLabel)}"
            aria-description="${selectedLabel}"
            aria-haspopup="listbox"
            aria-expanded="${this.expanded}"
            class="${classMap({invalid: selectedInvalid})}"
            @keydown="${this.onButtonKeyDown_}"
            @mousedown="${this.onButtonMouseDown_}">
          ${selectedLabel}
        </button>
        <ul
            tabindex="-1"
            role="listbox"
            aria-activedescendant="option-${selectedIndex}"
            @keydown="${this.onUlKeyDown_}"
            @focusin="${() => this.setUlFocused_(true)}"
            @focusout="${() => this.setUlFocused_(false)}">
          ${this.options.map(renderOption)}
        </ul>
    `;
  }

  /**
   * @param {number} index The option index.
   * @return {!TemplateResult}
   */
  renderDeleteButton_(index) {
    return html`
        <mwc-icon-button
            tabindex="-1"
            aria-label="${hterm.messageManager.get(
                'TERMINAL_DROPDOWN_DELETE_ITEM_TEXT')}"
            @click=${this.onDeleteClickHandler_(index)}
            @mouseenter=${(e) => this.hoverDeleteButton_ = true}
            @mouseleave=${(e) => this.hoverDeleteButton_ = false}>
          ${ICON_CANCEL}
        </mwc-icon-button>
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
    if (changedProperties.has('value')) {
      this.dispatchEvent(new CustomEvent('change',
          {detail: {value: this.value}}));
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
    let selected = this.findSelectedIndex_();
    if (selected === -1) {
      selected = this.options.length;
    }
    return this.selectFirstEnabled_(
        this.options.slice(0, selected).reverse());
  }

  selectNext_() {
    // findSelectedIndex_() could return -1, in this case, the code here will
    // select the first enabled option, which is want we want.
    return this.selectFirstEnabled_(
        this.options.slice(this.findSelectedIndex_() + 1));
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
      case 'Delete':
        this.maybeDispatchDeleteItemEvent_(this.findSelectedIndex_());
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

  /**
   * Return a click event handler for the delete button in the <li> element.
   *
   * @param {number} index The index of the option.
   * @return {function(!Event)}
   */
  onDeleteClickHandler_(index) {
    return (event) => {
      this.maybeDispatchDeleteItemEvent_(index);
      event.stopPropagation();
    };
  }

  /**
   * @param {number} index The index of the option.
   */
  maybeDispatchDeleteItemEvent_(index) {
    if (index < 0) {
      return;
    }
    const option = this.options[index];
    if (option.deletable) {
      this.dispatchEvent(new CustomEvent('delete-item', {
        detail: {
          index,
          option,
        },
      }));
    }
  }

  /** @param {boolean} focused */
  setUlFocused_(focused) {
    this.ulFocused_ = focused;
    if (!this.ulFocusedTaskScheduled_) {
      this.ulFocusedTaskScheduled_ = true;
      // Use a timeout so that we only react when all the related focus events
      // are handled.
      setTimeout(() => {
        this.ulFocusedTaskScheduled_ = false;
        if (!this.ulFocused_) {
          this.expanded = false;
        }
      });
    }
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
