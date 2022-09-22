// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-profile-selector.
 *
 * @suppress {moduleLoad}
 */

import {LitElement, createRef, css, html, ref} from './lit.js';
import './terminal_dropdown.js';
import {ICON_PLUS} from './terminal_icons.js';
import {ProfileType, deleteProfile, getProfileIds, setProfileIds}
  from './terminal_profiles.js';

export class TerminalSettingsProfileSelector extends LitElement {
  /** @override */
  static get properties() {
    return {
      activeSettingsProfile_: {state: true},
      settingsProfiles_: {state: true},
      confirmDeleteMsg_: {state: true},
    };
  }

  /** @override */
  static get styles() {
    return css`
      :host {
        display: block;
      }

      h2 {
        font-size: 14px;
        font-weight: 500;
        line-height: 20px;
        margin: 18px 0 8px 0;
      }

      #terminal-profile-new {
        cursor: pointer;
        float: right;
      }

      .icon svg {
        fill: var(--cros-textfield-label-color);
        height: 20px;
        width: 20px;
      }
    `;
  }

  constructor() {
    super();

    this.newProfileInputRef_ = createRef();
    this.newProfileDialogRef_ = createRef();
    this.deleteProfileDialogRef_ = createRef();

    this.settingsProfiles_ = [{value: hterm.Terminal.DEFAULT_PROFILE_ID}];
    this.activeSettingsProfile_ = hterm.Terminal.DEFAULT_PROFILE_ID;
    this.confirmDeleteMsg_ = '';
    /** @private {?Event} */
    this.deleteEvent_;

    getProfileIds(ProfileType.HTERM).then((profiles) => {
      // Ensure 'default' is first.
      profiles = [hterm.Terminal.DEFAULT_PROFILE_ID,
          ...profiles.filter((i) => i !== hterm.Terminal.DEFAULT_PROFILE_ID)];
      this.settingsProfiles_ = profiles.map((value) => ({
          value,
          deletable: value !== hterm.Terminal.DEFAULT_PROFILE_ID,
      }));
    });
  }

  /** @override */
  render() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);
    return html`
      <div id="terminal-profile-new" class="icon"
          @click="${this.openNewDialog_}">${ICON_PLUS}
      </div>
      <h2>${msg('TERMINAL_PROFILE_LABEL')}</h2>
      <terminal-dropdown
          .value=${this.activeSettingsProfile_}
          @change=${this.onSettingsProfileChange_}
          @delete-item=${this.openDeleteDialog_}
          .options="${this.settingsProfiles_}">
      </terminal-dropdown>
      <terminal-dialog ${ref(this.newProfileDialogRef_)}
          @close="${this.onNewDialogClose_}">
        <div slot="title">
          ${msg('TERMINAL_PROFILE_LABEL')}
        </div>
        <terminal-textfield ${ref(this.newProfileInputRef_)}
            @keydown="${this.onNewProfileKeydown_}">
        </terminal-textfield>
        </div>
      </terminal-dialog>
      <terminal-dialog ${ref(this.deleteProfileDialogRef_)}
          acceptText="${msg('DELETE_BUTTON_LABEL')}"
          @close=${this.onDeleteDialogClose_}>
        <div slot="title">${msg('DELETE_BUTTON_LABEL')}</div>
        ${this.confirmDeleteMsg_}
      </terminal-dialog>
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
    const value = this.newProfileInputRef_.value.value;
    if (!this.settingsProfiles_.some((p) => p.value === value)) {
      this.settingsProfiles_.push({value, deletable: true});
    }
    this.activeSettingsProfile_ = value;
    await setProfileIds(
        ProfileType.HTERM, this.settingsProfiles_.map((i) => i.value));
  }

  /**
   * @param {!Event} e
   * @private
   */
  onSettingsProfileChange_(e) {
    this.activeSettingsProfile_ = e.detail.value;
    window.preferenceManager.setProfile(this.activeSettingsProfile_);
  }

  /**
   * @param {!Event} e
   * @private
   */
  openDeleteDialog_(e) {
    this.deleteEvent_ = e;
    this.confirmDeleteMsg_ = hterm.messageManager.get(
        'TERMINAL_SETTINGS_DELETE_PROFILE_DIALOG_MESSAGE',
        e.detail.option.value);
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
    const i = this.deleteEvent_.detail.index;
    // Never delete first 'default' profile.
    if (i === 0) {
      return;
    }
    this.settingsProfiles_.splice(i, 1);
    const profile = this.deleteEvent_.detail.option.value;
    if (this.activeSettingsProfile_ === profile) {
      this.activeSettingsProfile_ = this.settingsProfiles_[i - 1].value;
    }
    await deleteProfile(ProfileType.HTERM, profile);
  }
}

customElements.define('terminal-settings-profile-selector',
    TerminalSettingsProfileSelector);
