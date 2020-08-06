// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-textfield.
 *
 * @suppress {moduleLoad}
 */
import {css, html, LitElement, live} from './lit_element.js';

export class TerminalTextfieldElement extends LitElement {
  /** @override */
  static get properties() {
    return {
      placeholder: {
        type: String,
      },
      value: {
        type: String,
      },
      // For styling.
      focused_: {
        type: Boolean,
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

      #underline[data-focused] {
        opacity: 1;
        transition: width 180ms ease-out, opacity 120ms ease-in;
        width: 100%;
      }
    `;
  }

  constructor() {
    super();

    this.placeholder = '';
    this.value = '';
    this.focused_ = false;
  }

  /** @override */
  render() {
    return html`
        <div id="container">
          <input type="text"
              .placeholder="${this.placeholder}"
              .value="${live(this.value)}"
              @blur=${() => this.focused_ = false}
              @focus=${() => this.focused_ = true}
              @change=${this.onChange_}
              @keydown=${this.passThroughEvent_}
          />
          <div id="underline" ?data-focused="${this.focused_}"></div>
        </div>
    `;
  }

  passThroughEvent_(event) {
    this.dispatchEvent(new event.constructor(event.type, event));
  }

  onChange_(event) {
    this.value = event.target.value;
    this.passThroughEvent_(event);
  }
}

customElements.define('terminal-textfield', TerminalTextfieldElement);
