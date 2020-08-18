// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-background.
 *
 * @suppress {moduleLoad}
 */
import {css, html, unsafeCSS} from './lit_element.js';
import {TerminalSettingsElement} from './terminal_settings_element.js';
import {stylesDialog} from './terminal_settings_styles.js';
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

const FOLDER_OPEN =
    '<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24">' +
    '<path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 ' +
    '0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" fill="rgb(26, 115, 232)"/>' +
    '</svg>';

export class TerminalSettingsBackgroundImageElement extends
    TerminalSettingsElement {
  static get is() { return 'terminal-settings-background-image'; }

  /** @override */
  static get properties() {
    return {
      imagePreviewSrc: {
        type: String,
      },
      errorMsg: {
        type: String,
      },
    };
  }

  /** @override */
  static get styles() {
    return [stylesDialog, css`
      :host {
        align-items: center;
        display: flex;
        flex-wrap: nowrap;
      }

      .error {
        margin-right: 12px;
        color: #d93025;
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

      .dialog-row {
        align-items: center;
        display: flex;
        flex-wrap: nowrap;
      }

      .open-folder {
        background: url('data:image/svg+xml;utf8,${unsafeCSS(FOLDER_OPEN)}')
            no-repeat left;
        display: inline-block;
        padding-left: 30px;
      }

      .button-left-margin {
        margin-left: 8px;
      }
    `];
  }

  constructor() {
    super();
    this.preference = 'background-image';
    /** @private {string} */
    this.imagePreviewSrc = '';
    /** @private {string} */
    this.errorMsg = '';
    this.cancelValue_ = '';
  }

  /** @override */
  render() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);

    const previewRemove = html`
      <img src="${this.imagePreviewSrc}" @click="${this.openDialog}">
      <terminal-settings-button id="bg-remove" class="button-left-margin"
         @click="${this.onRemove_}">
        ${msg('REMOVE_LABEL')}
      </terminal-settings-button>
    `;
    const select = html`
      <terminal-settings-button id="bg-select" @click="${this.onSelect_}">
        ${msg('SELECT_LABEL')}
      </terminal-settings-button>
    `;

    return html`
      <div class="error">${this.errorMsg}</div>
      ${this.imagePreviewSrc ? previewRemove : select}
      <input id="upload" type="file" @change="${this.onFileChange_}"/>
      <dialog>
        <div class="dialog-title">
          ${msg('TERMINAL_SETTINGS_BACKGROUND_IMAGE_DIALOG_TITLE')}
        </div>
        <div class="dialog-row">
          <terminal-settings-textfield preference="background-image"
              .placeholder="${msg('URL_LABEL')}"
              .converter=${BACKGROUND_IMAGE_CONVERTER}>
          </terminal-settings-textfield>
          <terminal-settings-button class="button-left-margin"
              @click="${this.onOpenFile_}">
            <span class="open-folder">${msg('SELECT_LABEL')}</span>
          </terminal-settings-button>
        </div>
        <div class="dialog-button-container">
          <terminal-settings-button class="cancel" @click="${this.onCancel_}">
            ${msg('CANCEL_BUTTON_LABEL')}
          </terminal-settings-button>
          <terminal-settings-button class="action" @click="${this.onOk_}">
            ${msg('CONFIRM_BUTTON_LABEL')}
          </terminal-settings-button>
        </div>
      </dialog>
    `;
  }

  /** @override */
  preferenceChanged_(prefValue) {
    super.preferenceChanged_(prefValue);
    // Update preview img only if we don't have a local image set.
    this.imagePreviewSrc = window.localStorage.getItem(this.preference) ||
        BACKGROUND_IMAGE_CONVERTER.preferenceToDisplay(prefValue);
  }

  openDialog() {
    this.cancelValue_ = this.value;
    this.shadowRoot.querySelector('dialog').showModal();
  }

  closeDialog() {
    this.shadowRoot.querySelector('dialog').close();
  }

  /** @param {!Event} event */
  onSelect_(event) {
    this.errorMsg = '';
    this.openDialog();
  }

  /** @param {!Event} event */
  onOpenFile_(event) {
    this.errorMsg = '';
    this.shadowRoot.querySelector('#upload').click();
  }

  onOk_(event) {
    this.closeDialog();
    const url = BACKGROUND_IMAGE_CONVERTER.preferenceToDisplay(this.value);
    if (url) {
      window.localStorage.removeItem(this.preference);
      this.imagePreviewSrc = url;
    }
  }

  onCancel_(event) {
    this.closeDialog();
    this.uiChanged_(this.cancelValue_);
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
      this.onFileLoad_(reader.result.toString());
    });
    reader.readAsDataURL(file);
    event.target.value = null;
    this.closeDialog();
  }

  /** @param {string} dataUrl */
  onFileLoad_(dataUrl) {
    try {
      window.localStorage.setItem(this.preference, dataUrl);
      this.imagePreviewSrc = dataUrl;
      this.uiChanged_('');
    } catch (e) {
      console.error(e);
      this.errorMsg = hterm.messageManager.get(
          'TERMINAL_SETTINGS_BACKGROUND_IMAGE_ERROR_SIZE');
    }
  }
}

customElements.define(TerminalSettingsBackgroundImageElement.is,
    TerminalSettingsBackgroundImageElement);
