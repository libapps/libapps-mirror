// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Export an element: terminal-ssh-dialog
 */

import {deleteIdentityFiles, getIdentityFileNames, importIdentityFiles}
    from './nassh_fs.js';

import {LitElement, createRef, css, html, live, ref} from './lit.js';
import './terminal_button.js';
import './terminal_dialog.js';
import './terminal_dropdown.js';
import './terminal_label.js';
import './terminal_textfield.js';

const GOOGLE_HOST_REGEXP = new RegExp(
    '\\.(' +
    'corp\\.google\\.com|' +
    'c\\.googlers\\.com|' +
    'cloud\\.googlecorp\\.com|' +
    '(internal|proxy)\\.gcpnode\\.com' +
    ')$');
// SSH options (e.g. '-4') that do not accept a value. Note that all SSH options
// only has one letter (following a hyphen), so we can just use a string to
// store all of them.
const SSH_FLAG_OPTIONS = '46AaCfGgKkMNnqsTtVvXxYy@';

/**
 * This represents a parsed SSH command. If the SSH command has a destination
 * argument, it should be stored in the `destination` field. All other arguments
 * should be stored in `argstr`.
 *
 * @typedef {{
 *   destination: ?string,
 *   argstr: string,
 * }}
 */
export let ParsedCommand;

/**
 * Parse the ssh command string.
 *
 * @param {string} command
 * @return {!ParsedCommand} The parsed command.
 */
export function parseCommand(command) {
  // Split the command into tokens. Like nassh, we (only) support simple
  // quoting with double quote symbols.
  const matches = command.matchAll(/(?:"[^"]*"|\S+)/g);
  let skipNext = false;
  for (const match of matches) {
    if (skipNext) {
      skipNext = false;
      continue;
    }

    // Remove the the double quotes if they are there.
    const arg = match[0].replace(/(^"|"$)/g, '');
    if (!arg.startsWith('-')) {
      // Found the destination argument.
      return {
        destination: arg,
        argstr: (command.slice(0, match.index) +
            command.slice(match.index + match[0].length)).trim(),
      };
    }

    // `arg` is an option. We needs to handle all these situations:
    //
    // - a flag option: e.g. '-4'
    // - an option that take a value in the next item: e.g. '-p'
    // - an option that take a value inplace: e.g. '-p22'
    // - a combination of flags, where the last one might take a value either
    //   inplace or not: e.g. '-4A', `-4Ap22`, or `-4Ap`  with the port number
    //   in the next item.
    for (let j = 1; j < arg.length; ++j) {
      if (SSH_FLAG_OPTIONS.includes(arg[j])) {
        continue;
      }
      // The option takes a value. If we have nothing left in `arg`, then the
      // value is in the next item.
      //
      // TODO(lxj): be stricter and check it against a list of known options?
      skipNext = j === (arg.length - 1);
      break;
    }
  }

  return {
    destination: null,
    argstr: command.trim(),
  };
}

/**
 * @typedef {{
 *   username: string,
 *   hostname: string,
 *   port: ?number,
 * }}
 */
export let ParsedDestination;

/**
 * @param {?string} destination Either 'username@hostname' or
 *     'ssh://username@hostname[:port]'.
 * @return {?ParsedDestination} Return null if it failed.
 */
export function parseSSHDestination(destination) {
  if (!destination) {
    return null;
  }

  // Match ssh://username@hostname[:port].
  const sshUrlMatch =
      destination.match(/^ssh:\/\/(.+)@([^:@]+)(?::(\d+))?$/i);
  if (sshUrlMatch) {
    const [username, hostname, port] = sshUrlMatch.slice(1);
    return {
      username,
      hostname,
      port: port ? Number.parseInt(port, 10) : null,
    };
  }

  // Match username@hostname
  const match = destination.match(/^(.+)@([^:@]+)$/);
  if (match) {
    const [username, hostname] = match.slice(1);
    return {username, hostname, port: null};
  }

  return null;
}

/**
 * The terminal ssh dialog for creating new ssh connections or modify existing
 * ones. Use method `show()` to set the nassh profile id and show the dialog.
 */
export class TerminalSSHDialog extends LitElement {
  /** @override */
  static get properties() {
    return {
      nasshProfileId_: {state: true},
      userTitle_: {state: true},
      parsedCommand_: {state: true},
      identities_: {state: true},
      suppressCommandError_: {state: true},
    };
  }

  /** @override */
  static get styles() {
    return css`
        :host {
          --terminal-dialog-min-width: 500px;
        }

        #identity-container {
          display: flex;
          margin-bottom: 16px;
        }

        #identity-dropdown {
          flex-grow: 1;
          margin-right: 8px;
        }

        #identity-input {
          display: none;
        }

        div[slot="buttons"] {
          display: flex;
        }

        div[slot="buttons"] > span {
          flex-grow: 1;
        }
    `;
  }

  constructor() {
    super();

    // The title manually set by the user.
    this.userTitle_ = '';
    /**
     * This should be in sync with `this.commandRef_.value.value`.
     *
     * @private {!ParsedCommand}
     */
    this.parsedCommand_ = {argstr: '', destination: null};
    // We suppress the command error for new ssh connection at the beginning
    // because we don't want to show the error immediately when (or before) the
    // user just start typing.
    this.suppressCommandError_ = true;
    // This is set in Show(). Empty string means we are creating a new SSH
    // connection.
    this.nasshProfileId_ = '';

    this.DEFAULT_IDENTITY = {
      label: hterm.messageManager.get('TERMINAL_HOME_DEFAULT_IDENTITY'),
      value: '',
    };
    this.identities_ = [this.DEFAULT_IDENTITY];
    /** @private {?FileSystem} */
    this.fileSystem_;

    this.dialogRef_ = createRef();
    this.commandRef_ = createRef();
    this.relayArgsRef_ = createRef();
    this.identityDropdownRef_ = createRef();
    this.okRef_ = createRef();
  }

  /** @return {string} */
  getTitle_() {
    if (this.userTitle_) {
      return this.userTitle_;
    }
    if (this.parsedCommand_.destination) {
      return this.parsedCommand_.destination;
    }
    return hterm.messageManager.get('TERMINAL_HOME_NEW_SSH_CONNECTION');
  }

  /** @override */
  render() {
    const msg = (id) => hterm.messageManager.get(id);

    let commandError = '';
    if (!parseSSHDestination(this.parsedCommand_.destination)) {
      commandError = msg('TERMINAL_HOME_SSH_SPECIFY_DESTINATION');
    } else {
      this.suppressCommandError_ = false;
    }

    let deleteButton;
    if (this.nasshProfileId_) {
      deleteButton = html`
          <terminal-button @click=${this.onDeleteClick_}>
            ${msg('DELETE_BUTTON_LABEL')}
          </terminal-button>
      `;
    }

    const identityLabel = msg('IDENTITY_LABEL');

    return html`
        <terminal-dialog ${ref(this.dialogRef_)}
            @close="${this.onDialogClose_}">
          <div slot="title">
            <terminal-textfield blendIn fitContent
                value="${live(this.getTitle_())}"
                @keydown="${this.onTextfieldKeydown_}"
                @change="${(e) => this.userTitle_ = e.target.value}">
            </terminal-textfield>
          </div>
          <terminal-textfield ${ref(this.commandRef_)}
              error="${this.suppressCommandError_ ? '' : commandError}"
              label="${msg('TERMINAL_HOME_SSH_COMMAND')}"
              @keydown="${this.onTextfieldKeydown_}"
              @change="${() => this.suppressCommandError_ = false}"
              @input="${this.onCommandUpdated_}"
              placeholder="username@hostname -p <port> -R 1234:localhost:5678">
            <span slot="inline-prefix">ssh&nbsp</span>
          </terminal-textfield>
          <terminal-label>${identityLabel}</terminal-label>
          <div id="identity-container">
            <terminal-dropdown
                ${ref(this.identityDropdownRef_)}
                ariaLabel="${identityLabel}"
                id="identity-dropdown"
                @delete-item=${this.onDeleteIdentity_}
                .options="${this.identities_}">
            </terminal-dropdown>
            <terminal-button @click=${this.onImportButtonClick_}>
              ${msg('TERMINAL_HOME_IMPORT_IDENTITY')}
            </terminal-button>
            <input id="identity-input" type="file" multiple
                @change=${this.onIdentityInputChange_}>
          </div>
          <terminal-textfield ${ref(this.relayArgsRef_)} id="relay-args"
              label="${msg('FIELD_NASSH_OPTIONS_PLACEHOLDER')}"
              @keydown="${this.onTextfieldKeydown_}">
          </terminal-textfield>
          <div slot="buttons">
            ${deleteButton}
            <span></span>
            <terminal-button class="cancel"
                @click="${(e) => this.dialogRef_.value.cancel()}">
              ${msg('CANCEL_BUTTON_LABEL')}
            </terminal-button>
            <terminal-button  ${ref(this.okRef_)} class="action"
                ?disabled="${commandError}"
                @click="${this.onOkClick_}">
              ${msg('SAVE_LABEL')}
            </terminal-button>
          </div>
        </terminal-dialog>
    `;
  }

  /**
   * Show the dialog. All content in the dialog will be refreshed automatically.
   *
   * @param {string=} nasshProfileId A non-empty value means editing an existing
   *     connection with the id. An empty value means creating a new connection.
   */
  async show(nasshProfileId = '') {
    // Since this dialog can be reused, we need to be careful here and make sure
    // we update all state (including member variables and also child HTML
    // elements that have internal state (e.g. `terminal-textfield`)).

    if (!this.fileSystem_) {
      this.fileSystem_ = await nassh.getFileSystem();
    }
    this.loadIdentities_();

    this.nasshProfileId_ = nasshProfileId;

    let command = '';
    let relayArgs = '';
    let identity = this.DEFAULT_IDENTITY.value;
    this.userTitle_ = '';

    if (this.nasshProfileId_) {
      [command, this.userTitle_, relayArgs, identity] =
          await this.getNasshProfileValues_([
            'terminalSSHDialogCommand',
            'description',
            'nassh-options',
            'identity',
          ], '');

      // We might have some old SSH profile without the "command". In this case,
      // we construct it from the other profile values.
      if (!command) {
        console.warn('Construct command string from other profile values.');
        const [username, hostname, port, argstr] =
            await this.getNasshProfileValues_([
              'username',
              'hostname',
              'port',
              'argstr',
            ], '');
        command = `${username}@${hostname}`;
        if (port) {
          command += ` -p ${port}`;
        }

        if (argstr) {
          command += ' ' + argstr;
        }
      }
    }

    this.commandRef_.value.value = command;
    this.parsedCommand_ = parseCommand(/** @type {string} */(command));
    this.relayArgsRef_.value.value = relayArgs;
    this.identityDropdownRef_.value.value = identity;
    this.suppressCommandError_ = !this.nasshProfileId_;

    this.shadowRoot.querySelector('terminal-dialog').show();
    this.shadowRoot.querySelector('terminal-textfield[fitContent]')
        .updateFitContentWidth();

    this.commandRef_.value.focus();
  }

  /**
   * @param {!Event} event
   */
  onOkClick_(event) {
    if (!event.target.hasAttribute('disabled')) {
      this.dialogRef_.value.accept();
    }
  }

  /**
   * @param {!Event} event
   */
  onDeleteClick_(event) {
    this.dialogRef_.value.cancel();
    this.deleteNasshProfile_();
  }

  /** @param {!Event} event */
  onCommandUpdated_(event) {
    this.parsedCommand_ = parseCommand(event.target.value);

    if (this.parsedCommand_.destination) {
      const parsedDestination = parseSSHDestination(
          this.parsedCommand_.destination);
      if (parsedDestination?.hostname.match(GOOGLE_HOST_REGEXP)) {
        const relayArgs = this.relayArgsRef_.value;
        // Add the google relay arg if it is not there already.
        if (!/(^|\s)--config=google\b/.test(relayArgs.value)) {
          relayArgs.value = `--config=google ${relayArgs.value}`;
        }
      }
    }
  }

  /** @param {!Event} event */
  onTextfieldKeydown_(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.okRef_.value.click();
    }
  }

  /** @param {!Event} event */
  onImportButtonClick_(event) {
    this.shadowRoot.querySelector('#identity-input').click();
  }

  /** @param {!Event} event */
  async onIdentityInputChange_(event) {
    await importIdentityFiles(lib.notNull(this.fileSystem_),
        event.target.files);
    this.loadIdentities_();
  }

  /** @param {!Event} event */
  async onDialogClose_(event) {
    if (event.detail.accept) {
      // Save the connection.

      const parsedDestination = parseSSHDestination(
          this.parsedCommand_.destination);
      if (!parsedDestination) {
        // This should not happen since we should have prevented the user from
        // clicking the ok button.
        throw new Error('Unable to parse destination from {}',
            this.parsedCommand_.destination);
      }

      if (this.nasshProfileId_) {
        // Remove the profile first to ensure a clean state.
        await this.deleteNasshProfile_(false);
      } else {
        const profileIds = await this.getNasshProfileIds_();
        this.nasshProfileId_ = lib.PreferenceManager.newRandomId(profileIds);
        await this.setNasshProfileIds_([
            ...profileIds,
            this.nasshProfileId_,
        ]);
      }
      this.setNasshProfileValues_({
        'terminalSSHDialogCommand': this.commandRef_.value.value,
        'description': this.getTitle_(),
        'username': parsedDestination.username,
        'hostname': parsedDestination.hostname,
        // We only save the port number if it appears in the destination. If the
        // user specify it with `-p`, then it will go into 'argstr'.
        'port': parsedDestination.port,
        'argstr': this.parsedCommand_.argstr,
        'nassh-options': this.relayArgsRef_.value.value,
        'identity': this.identityDropdownRef_.value.value,
      });
    }

    this.dispatchEvent(new CustomEvent('close'));
  }

  /**
   * @param {string} name
   * @return {string}
   */
  getNasshProfileKey_(name) {
    if (!this.nasshProfileId_) {
      throw new Error('nasshProfileId is empty');
    }
    return `/nassh/profiles/${this.nasshProfileId_}/${name}`;
  }

  /**
   * Get nassh ssh profile values. The return value is an array in the same
   * order as the param `names`.
   *
   * @param {!Array<string>} names
   * @param {*} defaultValue Missing value is replaced with this.
   * @return {!Promise<!Array<*>>}
   */
  async getNasshProfileValues_(names, defaultValue) {
    const keys = names.map((x) => this.getNasshProfileKey_(x));
    const rv = await window.storage.getItems(keys);
    return keys.map((k) => rv[k] ?? defaultValue);
  }

  /**
   * Set nassh profile values from an object.
   *
   * @param {!Object} values
   */
  async setNasshProfileValues_(values) {
    const values2 = {};
    for (const [name, value] of Object.entries(values)) {
      values2[this.getNasshProfileKey_(name)] = value;
    }
    await window.storage.setItems(values2);
  }

  async loadIdentities_() {
    this.identities_ = [
        this.DEFAULT_IDENTITY,
        ...(await getIdentityFileNames(lib.notNull(this.fileSystem_)))
            .map((value) => ({value, deletable: true})),
    ];
  }

  /** @return {!Promise<!Array<string>>} */
  async getNasshProfileIds_() {
    const profileIds = /** @type {?Array<string>}*/(
        await window.storage.getItem('/nassh/profile-ids'));
    return profileIds ?? [];
  }

  /**
   * @param {!Array<string>} profileIds
   * @return {!Promise<void>}
   */
  async setNasshProfileIds_(profileIds) {
    await window.storage.setItem('/nassh/profile-ids', profileIds);
  }

  async deleteNasshProfile_(deleteFromProfileIds = true) {
    if (deleteFromProfileIds) {
      await this.setNasshProfileIds_(
          (await this.getNasshProfileIds_())
              .filter((id) => id !== this.nasshProfileId_),
      );
    }
    const prefix = `/nassh/profiles/${this.nasshProfileId_}`;
    window.storage.removeItems(
        Object.keys(await window.storage.getItems(null))
            .filter((key) => key.startsWith(prefix)),
    );
  }

  async onDeleteIdentity_(e) {
    const identityName = e.detail.option.value;
    if (!identityName) {
      throw new Error('identity name is empty');
    }
    if (identityName === this.identityDropdownRef_.value.value) {
      // Switch to the default identity.
      this.identityDropdownRef_.value.value = '';
    }
    await deleteIdentityFiles(lib.notNull(this.fileSystem_), identityName);
    await this.loadIdentities_();
  }
}

customElements.define('terminal-ssh-dialog', TerminalSSHDialog);
