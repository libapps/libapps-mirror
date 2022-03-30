// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-dialog.
 *
 * @suppress {moduleLoad}
 */
import {css, html, LitElement} from './lit.js';
import './terminal_button.js';

// A dialog with an accept and a cancel button. When a button is clicked, the
// dialog is closed and a "close" event is sent with detail `{accept:
// trueIffAcceptIsClicked}`. Esc key is handled as if cancel button is clicked.
export class TerminalDialog extends LitElement {
  /** @override */
  static get properties() {
    return {
      acceptText: {
        type: String,
      },
      cancelText: {
        type: String,
      },
      open: {
        type: Boolean,
        reflect: true,
      },
    };
  }

  /** @override */
  static get styles() {
    return css`
        dialog {
          border: 0;
          border-radius: 8px;
          box-shadow: 0 0 16px rgba(0, 0, 0, 0.12),
                      0 16px 16px rgba(0, 0, 0, 0.24);
          color: var(--cr-secondary-text-color);
          font: 13px var(--font);
          overflow: hidden;
          padding: 20px 20px 16px 20px;
        }

        ::slotted(div[slot=title]) {
          color: var(--cr-primary-text-color);
          font-size: calc(15 / 13 * 100%);
          padding-bottom: 16px;
        }

        #button-container {
          display: flex;
          justify-content: flex-end;
          padding-top: 24px;
        }
    `;
  }

  constructor() {
    super();

    const msg = hterm.messageManager.get.bind(hterm.messageManager);
    this.acceptText = msg('OK_BUTTON_LABEL');
    this.cancelText = msg('CANCEL_BUTTON_LABEL');
    this.open = false;
  }

  /** @override */
  render() {
    return html`
        <dialog @close=${this.onNativeClose_}>
          <slot name="title"></slot>
          <slot></slot>
          <div id="button-container">
            <terminal-button class="cancel"
                @click="${this.cancel}">
              ${this.cancelText}
            </terminal-button>
            <terminal-button class="action" @click="${this.accept}">
              ${this.acceptText}
            </terminal-button>
          </div>
        </dialog>
    `;
  }

  getNativeDialog_() {
    return this.shadowRoot.querySelector('dialog');
  }

  show() {
    const nativeDialog = this.getNativeDialog_();
    nativeDialog.returnValue = 'cancel';
    nativeDialog.showModal();
    this.open = true;
  }

  onNativeClose_(event) {
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', {
      detail: {accept: event.target.returnValue == 'accept'},
    }));
  }

  accept() {
    this.getNativeDialog_().close('accept');
  }

  cancel() {
    this.getNativeDialog_().close('cancel');
  }
}

customElements.define('terminal-dialog', TerminalDialog);
