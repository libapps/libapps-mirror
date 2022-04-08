// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-textfield.
 *
 * @suppress {moduleLoad}
 */
import {LitElement, createRef, css, html, live, ref} from './lit.js';
import {redispatchEvent} from './terminal_common.js';
import './terminal_label.js';

export class TerminalTextfieldElement extends LitElement {
  /** @override */
  static get properties() {
    return {
      label: {
        type: String,
      },
      placeholder: {
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
      // For styling.
      //
      // TODO: It might be better to use `ShadowRoot.delegatesFocus` instead .
      // See
      // https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/delegatesFocus
      focused_: {
        type: Boolean,
        reflect: true,
      },
    };
  }

  /** @override */
  static get styles() {
    return css`
      :host {
        display: block;
      }

      #container {
        background-color: #F1F3F4;
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
        color: #202124;
        font-family: Roboto;
        font-size: 13px;
        line-height: 32px;
        outline: none;
        padding: 0;
        text-transform: var(--terminal-textfield-text-transform, none);
        width: 100%;
      }

      #underline {
        border-bottom: 2px solid var(--google-blue-600);
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

      :host([focused_]) #underline {
        opacity: 1;
        transition: width 180ms ease-out, opacity 120ms ease-in;
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
        box-shadow: 0 0 0 1px #E5E5E5;
      }

      :host([blendIn][focused_]) #container {
        box-shadow: 0 0 0 2px #1a73e8;
      }

      :host([blendIn]) input {
        font: inherit;
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

    this.label = '';
    this.placeholder = '';
    this.value = '';
    this.blendIn = false;
    this.fitContent = false;
    this.focused_ = false;

    this.rulerRef_ = createRef();
    this.inputRef_ = createRef();
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
          <terminal-label ?focused="${this.focused_}">
              ${this.label}
          </terminal-label>
      `;
    }

    let ruler;
    if (this.fitContent) {
      ruler = html`<span ${ref(this.rulerRef_)} id="ruler"></span>`;
    }

    return html`
        ${label}
        <div id="container">
          <div id="input-container">
            <slot name="inline-prefix"></slot>
            <input ${ref(this.inputRef_)} type="text"
                .placeholder="${this.placeholder}"
                .value="${live(this.value)}"
                @blur=${() => this.focused_ = false}
                @focus=${() => this.focused_ = true}
                @change=${(e) => redispatchEvent(this, e)}
                @input=${this.onInput_}
                spellcheck="false"
            />
          </div>
          ${this.blendIn ? '' : html`<div id="underline"></div>`}
        </div>
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
