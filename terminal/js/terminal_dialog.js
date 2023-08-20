// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-dialog.
 *
 * @suppress {moduleLoad}
 */

import {hterm} from '../../hterm/index.js';

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
          background: var(--cros-bg-color);
          border: 0;
          border-radius: 8px;
          box-shadow: 0 0 16px rgba(var(--cros-shadow-color-key-rgb), 0.12),
                      0 16px 16px rgba(var(--cros-shadow-color-key-rgb), 0.24);
          color: var(--cros-color-secondary);
          font: 13px var(--cros-body-1-font-family);
          min-width: var(--terminal-dialog-min-width);
          padding: 20px 20px 16px 20px;
          overflow: var(--terminal-dialog-overflow, auto);
        }

        ::slotted(div[slot=title]) {
          color: var(--cros-color-primary);
          font-size: calc(15 / 13 * 100%);
          padding-bottom: 16px;
        }

        #content {
          padding-bottom: 24px;
        }

        #button-container {
          display: flex;
          justify-content: flex-end;
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
          <div id="content">
            <slot></slot>
          </div>
          <slot name="buttons">
            <div id="button-container">
              <terminal-button class="cancel"
                  @click="${this.cancel}">
                ${this.cancelText}
              </terminal-button>
              <terminal-button class="action" @click="${this.accept}">
                ${this.acceptText}
              </terminal-button>
            </div>
          </slot>
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
    this.dispatchEvent(new CustomEvent('open'));
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
