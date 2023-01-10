// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-profile-item.
 *
 * @suppress {moduleLoad}
 */

import {hterm} from './deps_local.concat.js';

import {LitElement, createRef, css, html, ref, when} from './lit.js';
import './terminal_dialog.js';
import {ICON_CLOSE} from './terminal_icons.js';
import {ProfileType, deleteProfile} from './terminal_profiles.js';

export class TerminalSettingsProfileItem extends LitElement {
  /** @override */
  static get properties() {
    return {
      profile: {type: String},
      confirmDeleteMsg_: {state: true},
    };
  }

  /** @override */
  static get styles() {
    return css`
      :host {
        display: block;
      }

      mwc-icon-button {
        display: none;
        float: right;
        margin: 4px -20px 0 0;
        --mdc-icon-button-size: 24px;
        --mdc-icon-size: 20px;
        --mdc-ripple-color: var(--cros-ripple-color);
      }

      :host(:hover) mwc-icon-button {
        display: block;
      }

      .icon svg {
        fill: var(--cros-textfield-label-color);
        height: 16px;
        width: 16px;
      }
    `;
  }

  constructor() {
    super();
    this.profile = '';
    this.confirmDeleteMsg_ = '';
    this.addEventListener('click', (e) => {
      this.dispatchEvent(new CustomEvent('settings-profile-click', {
        detail: {profile: this.profile},
      }));
    });

    this.deleteProfileDialogRef_ = createRef();
  }

  /** @override */
  render() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);
    return html`
      ${when(this.profile !== hterm.Terminal.DEFAULT_PROFILE_ID, () => html`
        <mwc-icon-button @click=${this.openDeleteDialog_}>
          ${ICON_CLOSE}
        </mwc-icon-button>
      `)}
      ${this.profile}
      <terminal-dialog ${ref(this.deleteProfileDialogRef_)}
          acceptText="${msg('DELETE_BUTTON_LABEL')}"
          @click=${(e) => e.stopPropagation()}
          @close=${this.onDeleteDialogClose_}>
        <div slot="title">${msg('DELETE_BUTTON_LABEL')}</div>
        ${this.confirmDeleteMsg_}
      </terminal-dialog>
    `;
  }

  /**
   * @param {!Event} e
   * @private
   */
  openDeleteDialog_(e) {
    e.stopPropagation();
    this.confirmDeleteMsg_ = hterm.messageManager.get(
        'TERMINAL_SETTINGS_PROFILE_DELETE_DIALOG_MESSAGE', [this.profile]);
    this.deleteProfileDialogRef_.value.show();
  }

  /**
   * @param {!Event} e
   * @private
   */
  async onDeleteDialogClose_(e) {
    if (!e.detail.accept) {
      return;
    }
    await deleteProfile(ProfileType.HTERM, this.profile);
    this.dispatchEvent(new CustomEvent('settings-profile-delete', {
      detail: {profile: this.profile},
    }));
  }
}

customElements.define('terminal-settings-profile-item',
    TerminalSettingsProfileItem);
