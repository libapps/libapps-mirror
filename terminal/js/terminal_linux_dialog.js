// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Export an element: terminal-linux-dialog
 */

import {hterm} from '../../hterm/index.js';

import {LitElement, createRef, css, html, ref} from './lit.js';
import './terminal_dialog.js';
import './terminal_dropdown.js';
import './terminal_label.js';
import {ProfileType, getProfileIds, getVshProfiles, setVshProfiles}
  from './terminal_profiles.js';
import './terminal_textfield.js';

export class TerminalLinuxDialog extends LitElement {
  /**
   * @return {!Object<string, !PropertyDeclaration>}
   * @override
   */
  static get properties() {
    return {
      vshProfileId_: {state: true},
      userTitle_: {state: true},
      settingsProfiles_: {state: true},
    };
  }

  /**
   * @return {!CSSResult|!Array<!CSSResult>}
   * @override
   */
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
    return hterm.messageManager.get('TERMINAL_HOME_NEW_LINUX');
  }

  /**
   * @return {!TemplateResult}
   * @override
   */
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
   * @param {string} id
   * @param {string} title
   */
  async show(id, title) {
    this.vshProfileId_ = id;
    this.userTitle_ = title;

    this.settingsProfiles_ = /** @type {?Array<string>}*/ (
        await getProfileIds(ProfileType.HTERM)) ||
        [hterm.Terminal.DEFAULT_PROFILE_ID];

    const profiles = getVshProfiles();
    this.settingsProfileDropdownRef_.value.value =
        profiles[id]['terminal-profile'] || hterm.Terminal.DEFAULT_PROFILE_ID;

    this.shadowRoot.querySelector('terminal-dialog').show();
    this.settingsProfileDropdownRef_.value.focus();
  }

  /** @param {!Event} event */
  async onDialogClose_(event) {
    if (event.detail.accept) {
      // Save the connection.
      const profiles = getVshProfiles();
      profiles[this.vshProfileId_]['terminal-profile'] =
          this.settingsProfileDropdownRef_.value.value;
      setVshProfiles(profiles);
    }

    this.dispatchEvent(new CustomEvent('close'));
  }
}

customElements.define('terminal-linux-dialog', TerminalLinuxDialog);
