// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-background.
 *
 * @suppress {moduleLoad}
 */
import {css, html} from './lit_element.js';
import {TerminalSettingsElement} from './terminal_settings_element.js';
import './terminal_settings_button.js';
import './terminal_settings_textfield.js';

export const BACKGROUND_IMAGE_CONVERTER = {
  preferenceToDisplay: (preference) => {
    preference = preference ? preference.toString().trim() : '';
    const result = preference.match(/^url\(['"]?(.*?)['"]?\)$/i);
    return result ? result[1] : preference;
  },
  displayToPreference: (display) => {
    display = display.trim();
    if (!display) {
      return '';
    }
    const prefix = RegExp('^https?://', 'i').test(display) ? '' : 'http://';
    return `url(${prefix}${display})`;
  },
};

export class TerminalSettingsBackgroundImageElement extends
    TerminalSettingsElement {
  static get is() { return 'terminal-settings-background-image'; }

  /** @override */
  static get properties() {
    return {
      imagePreviewSrc: {
        type: String,
      },
      showUrl: {
        type: Boolean,
      },
      errorMsg: {
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
        margin-left: 6px;
        color: #d93025;
      }

      img {
        border-radius: 8px;
        max-height: 40px;
        max-width: 100px;
      }

      input[type="file"] {
        display: none;
      }

      terminal-settings-button {
        margin-left: 6px;
      }
    `;
  }

  constructor() {
    super();
    this.preference = 'background-image';
    /** @private {string} */
    this.imagePreviewSrc = '';
    /** @private {boolean} */
    this.showUrl = false;
    /** @private {string} */
    this.errorMsg = '';
  }

  /** @override */
  render() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);

    const textfield = html`
      <terminal-settings-textfield preference="background-image"
          .converter=${BACKGROUND_IMAGE_CONVERTER}>
      </terminal-settings-textfield>
    `;
    const previewRemove = html`
      <img src="${this.imagePreviewSrc}">
      <terminal-settings-button id="bg-remove" @click="${this.onRemove_}">
        ${msg('REMOVE_LABEL')}
      </terminal-settings-button>
    `;
    const select = html`
      <terminal-settings-button id="bg-url" @click="${this.onShowUrl_}">
        ${msg('URL_LABEL')}
      </terminal-settings-button>
      <terminal-settings-button id ="bg-file" @click="${this.onOpenFile_}">
        ${msg('FILE_LABEL')}
      </terminal-settings-button>
      <input id="upload" type="file" @change="${this.onFileChange_}"/>
    `;

    return html`
      <div class="error">${this.errorMsg}</div>
      ${this.showUrl ? textfield : ''}
      ${this.imagePreviewSrc ? previewRemove : select}
    `;
  }

  /** @override */
  preferenceChanged_(prefValue) {
    super.preferenceChanged_(prefValue);
    this.showUrl = !!prefValue;
    this.imagePreviewSrc =
        BACKGROUND_IMAGE_CONVERTER.preferenceToDisplay(prefValue) ||
        window.localStorage.getItem(this.preference);
  }

  /** @param {!Event} event */
  onShowUrl_(event) {
    this.errorMsg = '';
    this.showUrl = true;
  }

  /** @param {!Event} event */
  onOpenFile_(event) {
    this.errorMsg = '';
    this.showUrl = false;
    this.shadowRoot.querySelector('#upload').click();
  }

  /** @param {!Event} event */
  onRemove_(event) {
    this.imagePreviewSrc = '';
    this.errorMsg = '';
    window.localStorage.removeItem(this.preference);
    this.uiChanged_('');
  }

  /** @param {!Event} event */
  onFileChange_(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const dataUrl = /** @type {string} */ (reader.result);
      try {
        window.localStorage.setItem(this.preference, dataUrl);
        this.imagePreviewSrc = dataUrl;
      } catch (e) {
        console.error(e);
        this.errorMsg = hterm.messageManager.get(
            'TERMINAL_SETTINGS_BACKGROUND_IMAGE_ERROR_SIZE');
      }
    });
    reader.readAsDataURL(file);
    event.target.value = null;
  }
}

customElements.define(TerminalSettingsBackgroundImageElement.is,
    TerminalSettingsBackgroundImageElement);
