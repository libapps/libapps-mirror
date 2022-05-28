// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Export an element: terminal-linux-dialog
 */

import {LitElement, createRef, css, html, ref} from './lit.js';
import './terminal_dialog.js';
import './terminal_dropdown.js';
import './terminal_label.js';
import {ProfileType, deleteProfile, getProfileIds, getProfileValues,
  setProfileIds, setProfileValues} from './terminal_profiles.js';
import './terminal_textfield.js';

export class TerminalLinuxDialog extends LitElement {
  /** @override */
  static get properties() {
    return {
      vshProfileId_: {state: true},
      userTitle_: {state: true},
      vmName_: {state: true},
      containerName_: {state: true},
      settingsProfiles_: {state: true},
    };
  }

  /** @override */
  static get styles() {
    return css`
        :host {
          --terminal-dialog-min-width: 500px;
        }

        #settings-profile-container {
          margin-bottom: 16px;
        }
    `;
  }

  constructor() {
    super();

    // The title manually set by the user.
    this.userTitle_ = '';
    this.vmName_ = '';
    this.containerName_ = '';
    // This is set in Show(). Empty string means we are creating a new VSH
    // connection.
    this.vshProfileId_ = '';

    this.settingsProfiles_ = [hterm.Terminal.DEFAULT_PROFILE_ID];

    this.dialogRef_ = createRef();
    this.settingsProfileDropdownRef_ = createRef();
  }

  /** @return {string} */
  getTitle_() {
    if (this.userTitle_) {
      return this.userTitle_;
    }
    return hterm.messageManager.get('TERMINAL_HOME_NEW_LINUX_CONNECTION');
  }

  /** @override */
  render() {
    const msg = (id) => hterm.messageManager.get(id);

    const settingsProfileLabel = msg('TERMINAL_PROFILE_LABEL');

    return html`
        <terminal-dialog ${ref(this.dialogRef_)}
            @close="${this.onDialogClose_}">
          <div slot="title">
            ${this.getTitle_()}
          </div>
          <div id="settings-profile-container">
            <terminal-label>${settingsProfileLabel}</terminal-label>
            <terminal-dropdown
                ${ref(this.settingsProfileDropdownRef_)}
                ariaLabel="${settingsProfileLabel}"
                .options="${this.settingsProfiles_.map((value) => ({value}))}">
            </terminal-dropdown>
          </div>
        </terminal-dialog>
    `;
  }

  /**
   * Show the dialog. All content in the dialog will be refreshed automatically.
   *
   * @param {string=} vshProfileId A non-empty value means editing an existing
   *     connection with the id. An empty value means creating a new connection.
   */
  async show(vshProfileId = '') {
    // Since this dialog can be reused, we need to be careful here and make sure
    // we update all state (including member variables and also child HTML
    // elements that have internal state (e.g. `terminal-textfield`)).

    this.vshProfileId_ = vshProfileId;

    let settingsProfile = '';
    this.userTitle_ = '';

    if (this.vshProfileId_) {
      [this.userTitle_, this.vmName_, this.containerName_, settingsProfile] =
          await getProfileValues(ProfileType.VSH, this.vshProfileId_, [
            'description',
            'vm-name',
            'container-name',
            'terminal-profile',
          ], '');
    }

    this.settingsProfiles_ = /** @type {?Array<string>}*/ (
        await getProfileIds(ProfileType.HTERM)) ||
        [hterm.Terminal.DEFAULT_PROFILE_ID];

    this.settingsProfileDropdownRef_.value.value =
        settingsProfile || hterm.Terminal.DEFAULT_PROFILE_ID;

    this.shadowRoot.querySelector('terminal-dialog').show();
    this.settingsProfileDropdownRef_.value.focus();
  }

  /** @param {!Event} event */
  async onDialogClose_(event) {
    if (event.detail.accept) {
      // Save the connection.

      if (this.vshProfileId_) {
        // Remove the profile first to ensure a clean state.
        await deleteProfile(ProfileType.VSH, this.vshProfileId_, false);
      } else {
        const profileIds = await getProfileIds(ProfileType.VSH);
        this.vshProfileId_ = lib.PreferenceManager.newRandomId(profileIds);
        await setProfileIds(ProfileType.VSH, [
            ...profileIds,
            this.vshProfileId_,
        ]);
      }
      setProfileValues(ProfileType.VSH, this.vshProfileId_, {
        'description': this.getTitle_(),
        'vm-name': this.vmName_,
        'container-name': this.containerName_,
        'terminal-profile': this.settingsProfileDropdownRef_.value.value,
      });
    }

    this.dispatchEvent(new CustomEvent('close'));
  }
}

customElements.define('terminal-linux-dialog', TerminalLinuxDialog);
