// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-profile-item.
 *
 * @suppress {moduleLoad}
 */

import {hterm} from '../../hterm/index.js';

import {LitElement, createRef, css, html, ref, when} from './lit.js';
import './terminal_dialog.js';
import {ICON_CLOSE, ICON_ERROR} from './terminal_icons.js';
import {ProfileType, deleteProfile, resetTerminalProfileToDefault}
  from './terminal_profiles.js';

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
        float: right;
        margin: 4px -20px 0 0;
        --mdc-icon-button-size: 24px;
        --mdc-icon-size: 20px;
        --mdc-ripple-color: var(--cros-ripple-color);
      }

      mwc-icon-button svg {
        fill: var(--cros-bg-color);
      }

      :host([active]) mwc-icon-button svg {
        fill: var(--cros-highlight-color)
      }

      :host(:hover) mwc-icon-button svg,
      :host(:focus) mwc-icon-button svg {
        fill: currentcolor;
      }

      terminal-dialog svg {
        fill: var(--cros-color-alert);
        height: 36px;
        margin: 0 0 16px;
        width: 36px;
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
    const title = msg(
        'TERMINAL_SETTINGS_PROFILE_DELETE_DIALOG_TITLE', [this.profile]);
    return html`
      ${this.profile}
      <terminal-dialog ${ref(this.deleteProfileDialogRef_)}
          acceptText="${msg('DELETE_BUTTON_LABEL')}"
          @click=${(e) => e.stopPropagation()}
          @close=${this.onDeleteDialogClose_}>
        <div slot="title">
          <div>${ICON_ERROR}</div>
          ${title}
        </div>
        ${this.confirmDeleteMsg_}
      </terminal-dialog>
      ${when(this.profile !== hterm.Terminal.DEFAULT_PROFILE_ID, () => html`
        <mwc-icon-button aria-label="${title}" role="button"
            @click=${this.openDeleteDialog_}>
          ${ICON_CLOSE}
        </mwc-icon-button>
      `)}
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
    await resetTerminalProfileToDefault(this.profile);
    this.dispatchEvent(new CustomEvent('settings-profile-delete', {
      detail: {profile: this.profile},
    }));
  }
}

customElements.define('terminal-settings-profile-item',
    TerminalSettingsProfileItem);
