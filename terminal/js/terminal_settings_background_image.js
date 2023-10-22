// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-background-image.
 *
 * @suppress {moduleLoad}
 */

import {hterm} from '../../hterm/index.js';

import {css, html, LitElement} from './lit.js';
import './terminal_button.js';
import {backgroundImageLocalStorageKey} from './terminal_common.js';

export class TerminalSettingsBackgroundImageElement extends LitElement {
  static get is() { return 'terminal-settings-background-image'; }

  /** @override */
  static get properties() {
    return {
      imagePreviewSrc_: {
        type: String,
      },
      errorMsg_: {
        type: String,
      },
    };
  }

  /** @override */
  static get styles() {
    return css`
      :host {
        align-items: center;
        display: flex;
        flex-wrap: nowrap;
      }

      .error {
        margin-right: 12px;
        color: var(--cros-color-alert)
      }

      img {
        border-radius: 8px;
        cursor: pointer;
        margin-left: 6px;
        max-height: 33px;
        max-width: 100px;
      }

      input[type="file"] {
        display: none;
      }

      .button-left-margin {
        margin-left: 8px;
      }
    `;
  }

  constructor() {
    super();
    /** @private {string} */
    this.key_ = '';
    /** @private {string} */
    this.imagePreviewSrc_ = '';
    /** @private {string} */
    this.errorMsg_ = '';
    window.preferenceManager.onPrefixChange.addListener(
        this.profileChanged_.bind(this));
    this.profileChanged_();
  }

  /** @private */
  profileChanged_() {
    this.key_ = backgroundImageLocalStorageKey(window.preferenceManager);
    this.imagePreviewSrc_ = window.localStorage.getItem(this.key_) || '';
  }

  /** @override */
  render() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);

    const select = html`
      <terminal-button id='bg-select' class="button-left-margin"
        ariaLabel="${msg('SELECT_LABEL')} ${msg('TERMINAL_NAME_PREF_IMAGE')}"
        aria-description="${msg('TERMINAL_SETTINGS_BACKGROUND_IMAGE_HELP')}"
        @click="${this.onOpenFile_}">
        ${msg('SELECT_LABEL')}
      </terminal-button>
    `;
    const previewRemove = html`
      <img src="${this.imagePreviewSrc_}" @click="${this.onOpenFile_}">
      <terminal-button id="bg-remove" class="button-left-margin"
          ariaLabel="${msg('REMOVE_LABEL')} ${msg('TERMINAL_NAME_PREF_IMAGE')}"
          @click="${this.onRemove_}">
       ${msg('REMOVE_LABEL')}
      </terminal-button>
    `;
    return html`
      <div class="error">${this.errorMsg_}</div>
      ${this.imagePreviewSrc_ ? previewRemove : select}
      <input id="upload" type="file" @change="${this.onFileChange_}"/>
    `;
  }

  /** @param {!Event} event */
  onOpenFile_(event) {
    this.errorMsg_ = '';
    this.shadowRoot.querySelector('#upload').click();
  }

  /** @param {!Event} event */
  onRemove_(event) {
    this.imagePreviewSrc_ = '';
    this.errorMsg_ = '';
    window.localStorage.removeItem(this.key_);
  }

  /** @param {!Event} event */
  onFileChange_(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      this.onFileLoad_(reader.result.toString());
    });
    reader.readAsDataURL(file);
    event.target.value = null;
  }

  /** @param {string} dataUrl */
  onFileLoad_(dataUrl) {
    try {
      window.localStorage.setItem(this.key_, dataUrl);
      this.imagePreviewSrc_ = dataUrl;
    } catch (e) {
      console.error(e);
      this.errorMsg_ = hterm.messageManager.get(
          'TERMINAL_SETTINGS_BACKGROUND_IMAGE_ERROR_SIZE');
    }
  }
}

customElements.define(TerminalSettingsBackgroundImageElement.is,
    TerminalSettingsBackgroundImageElement);
