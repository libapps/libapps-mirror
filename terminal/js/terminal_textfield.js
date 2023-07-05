// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-textfield.
 *
 * @suppress {moduleLoad}
 */
import {LitElement, createRef, css, html, ifDefined, live, ref} from './lit.js';
import {redispatchEvent} from './terminal_common.js';
import './terminal_label.js';

export class TerminalTextfieldElement extends LitElement {
  /** @override */
  static get properties() {
    return {
      label: {
        type: String,
      },
      // The aria label for the <input>. If this is undefined, we will fallback
      // to `label`.
      ariaLabel: {
        type: String,
      },
      placeholder: {
        type: String,
      },
      title: {
        type: String,
      },
      value: {
        type: String,
      },
      // If true, use the blend-in style, which
      //
      // - inherits styles such as font and background color from the
      //   environment
      // - when focus (and hover), displays an border instead of the underline
      //   effect
      blendIn: {
        type: Boolean,
      },
      // If true, the (max-)width of the element will fit the content.
      fitContent: {
        type: Boolean,
      },
      // An empty string does not trigger the error styling, but it will reserve
      // the space for the error message.
      error: {
        type: String,
      },
      // The type for the <input>. The default is "text".
      inputType: {
        type: String,
      },
      focused_: {
        state: true,
      },
    };
  }

  /** @override */
  static get shadowRootOptions() {
    return {
      ...super.shadowRootOptions,
      delegatesFocus: true,
    };
  }

  /** @override */
  static get styles() {
    return css`
      :host {
        display: block;
      }

      #container {
        background-color: var(--cros-textfield-background-color);
        border-radius: 4px;
        box-sizing: border-box;
        overflow: hidden;
        padding: 0 8px;
        position: relative;
        width: 100%;
      }

      input {
        background-color: inherit;
        border: none;
        color: var(--cros-color-primary);
        font-family: Roboto;
        font-size: 13px;
        line-height: 32px;
        outline: none;
        padding: 0;
        text-transform: var(--terminal-textfield-text-transform, none);
        width: 100%;
      }

      input::placeholder, slot[name=inline-prefix] {
        color: var(--cros-color-secondary);
      }

      #underline {
        border-bottom: 2px solid var(--cros-color-prominent);
        bottom: 0;
        box-sizing: border-box;
        left: 0;
        margin: auto;
        opacity: 0;
        position: absolute;
        right: 0;
        transition: opacity 120ms ease-out, width 0s linear 180ms;
        width: 0;
      }

      :host(:focus) #underline {
        opacity: 1;
        transition: width 180ms ease-out, opacity 120ms ease-in;
        width: 100%;
      }

      #underline[invalid] {
        border-bottom-color: var(--cros-color-alert);
        opacity: 1;
        width: 100%;
      }

      #input-container {
        align-items: baseline;
        display: flex;
      }

      :host([blendIn]) #container {
        background-color: inherit;
      }

      :host([blendIn]:hover) #container {
        box-shadow: 0 0 0 1px var(--cros-separator-color);
      }

      :host([blendIn]:focus) #container {
        box-shadow: 0 0 0 2px var(--cros-color-prominent);
      }

      :host([blendIn]) input {
        font: inherit;
      }

      /* The sizes are copied from chrome's <cr-input>. */
      #error {
        color: var(--cros-color-alert);
        font-size: .625rem;
        line-height: 1em;
        height: 1em;
        margin: 8px 0;
      }

      /* Note that "absolute" position does not work because the ruler size will
       * be restricted by the host size. */
      #ruler {
        position: fixed;
        visibility: hidden;
      }
    `;
  }

  constructor() {
    super();

    this.label = undefined;
    this.ariaLabel = undefined;
    this.placeholder = '';
    this.title = '';
    this.value = '';
    this.blendIn = false;
    this.fitContent = false;
    /** @type {string|undefined} */
    this.error;
    /** @type {string|undefined} */
    this.inputType;
    this.focused_ = false;

    this.rulerRef_ = createRef();
    this.inputRef_ = createRef();

    this.addEventListener('focus', () => this.focused_ = true);
    this.addEventListener('blur', () => this.focused_ = false);
  }

  /** @override */
  shouldUpdate(changedProperties) {
    if (changedProperties.size === 1 && changedProperties.has('value')) {
      return this.value !== this.inputRef_.value?.value;
    }
    return true;
  }

  /** @override */
  render() {
    let label;
    if (this.label) {
      label = html`
          <terminal-label id="label" ?focused="${this.focused_}"
              ?invalid="${this.error}">
            ${this.label}
          </terminal-label>
      `;
    }

    let ruler;
    if (this.fitContent) {
      ruler = html`<span ${ref(this.rulerRef_)} id="ruler"></span>`;
    }

    let error;
    if (this.error !== undefined) {
      error = html`<div id="error" aria-live="assertive">${this.error}</div>`;
    }

    return html`
        ${label}
        <div id="container">
          <div id="input-container">
            <slot name="inline-prefix"></slot>
            <input ${ref(this.inputRef_)} type="${this.inputType || 'text'}"
                .placeholder="${this.placeholder}"
                .value="${live(this.value)}"
                .title="${this.title}"
                @change=${(e) => redispatchEvent(this, e)}
                @input=${this.onInput_}
                spellcheck="false"
                aria-label=${ifDefined(this.ariaLabel ?? this.label)}
                aria-invalid=${!!this.error}
                aria-errormessage="error"
            />
          </div>
          ${this.blendIn ? '' :
            html`<div id="underline" ?invalid="${this.error}"></div>`}
        </div>
        ${error}
        ${ruler}
    `;
  }

  /** @override */
  updated(changedProperties) {
    if (changedProperties.has('value')) {
      this.maybeFitContent_();
    }
  }

  /** @param {!Event} event */
  onInput_(event) {
    this.value = event.target.value;
    this.maybeFitContent_();
  }

  maybeFitContent_() {
    if (!this.fitContent) {
      return;
    }
    const ruler = this.rulerRef_.value;
    const newContent = this.inputRef_.value.value + 'XXX';
    if (ruler.textContent !== newContent) {
      ruler.textContent = newContent;
      this.updateFitContentWidth();
    }
  }

  /**
   * Update the element width to fit the content. You don't normally need to
   * call this by yourself unless this element is transiting from hidden to
   * visible (e.g. when the element is in a dialog and the `dialog.showModal()`
   * is called).
   */
  updateFitContentWidth() {
    const ruler = this.rulerRef_.value;
    if (!ruler) {
      return;
    }
    if (ruler.offsetWidth !== 0) {
      this.style.maxWidth = `${ruler.offsetWidth}px`;
    } else {
      // We are not able to get the ruler size synchronously. It seems that this
      // can happen when this function is called inside a microtask. Schedule
      // another microtask to get the size.
      window.queueMicrotask(() => {
        this.style.maxWidth = `${ruler.offsetWidth}px`;
      });
    }
  }
}

customElements.define('terminal-textfield', TerminalTextfieldElement);
