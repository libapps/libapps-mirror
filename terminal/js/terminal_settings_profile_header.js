// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-profile-header.
 *
 * @suppress {moduleLoad}
 */

import {hterm} from '../../hterm/index.js';

import {LitElement, createRef, css, html, ref} from './lit.js';
import './terminal_dialog.js';
import {ICON_PLUS} from './terminal_icons.js';
import {ProfileType, getProfileIds, setProfileIds}
  from './terminal_profiles.js';
import './terminal_textfield.js';

export class TerminalSettingsProfileHeader extends LitElement {
  /** @override */
  static get properties() {
    return {
      confirmDeleteMsg_: {state: true},
    };
  }

  /** @override */
  static get styles() {
    return css`
      :host {
        display: flex;
        justify-content: space-between;
      }

      h2 {
        font-size: 14px;
        font-weight: 500;
        line-height: 32px;
        margin: 0;
      }

      mwc-icon-button {
        margin: 0 6px 0 0;
        --mdc-icon-button-size: 24px;
        --mdc-icon-size: 20px;
        --mdc-ripple-color: var(--cros-ripple-color);
      }
    `;
  }

  constructor() {
    super();

    this.newProfileInputRef_ = createRef();
    this.newProfileDialogRef_ = createRef();
  }

  /** @override */
  render() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);
    const title = msg('TERMINAL_SETTINGS_PROFILE_CREATE_DIALOG_TITLE');
    return html`
      <h2>${msg('TERMINAL_PROFILE_LABEL')}</h2>
      <terminal-dialog ${ref(this.newProfileDialogRef_)}
          @close="${this.onNewDialogClose_}">
        <div slot="title">${title}</div>
        <terminal-textfield ${ref(this.newProfileInputRef_)}
            label="${msg('TERMINAL_PROFILE_NAME_LABEL')}"
            @keydown="${this.onNewProfileKeydown_}">
        </terminal-textfield>
      </terminal-dialog>
      <mwc-icon-button aria-label="${title}" @click="${this.openNewDialog_}">
        ${ICON_PLUS}
      </mwc-icon-button>
    `;
  }


  /** @private */
  openNewDialog_() {
    this.newProfileInputRef_.value.value = '';
    this.newProfileDialogRef_.value.show();
  }

  /**
   * @param {!Event} e
   * @private
   */
  onNewProfileKeydown_(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.newProfileDialogRef_.value.accept();
    }
  }

  /**
   * @param {!Event} e
   * @private
   */
  async onNewDialogClose_(e) {
    if (!e.detail.accept) {
      return;
    }
    const profile = this.newProfileInputRef_.value.value;
    const profiles = await getProfileIds(ProfileType.HTERM);
    if (!profiles.includes(profile)) {
      profiles.push(profile);
      await setProfileIds(ProfileType.HTERM, profiles);
    }
    this.dispatchEvent(new CustomEvent('settings-profile-add', {
      detail: {profile},
    }));
  }
}

customElements.define('terminal-settings-profile-header',
    TerminalSettingsProfileHeader);
