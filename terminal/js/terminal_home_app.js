// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-home-app.
 *
 * @suppress {moduleLoad}
 */

import {hterm} from './deps_local.concat.js';

import {LitElement, createRef, css, html, ref, when} from './lit.js';
import './terminal_button.js';
import {DEFAULT_VM_NAME, composeSshUrl} from './terminal_common.js';
import './terminal_context_menu.js';
import {ICON_CODE, ICON_DOMAIN, ICON_EDIT, ICON_LINUX, ICON_MORE_VERT,
  ICON_OPEN_IN_NEW, ICON_PLUS, ICON_SETTINGS,
  ICON_SSH} from './terminal_icons.js';
import './terminal_linux_dialog.js';
import {ProfileType, cleanupVshSyncPrefs, deleteProfile, getProfileIds,
  getVshProfiles, setVshProfiles} from './terminal_profiles.js';
import './terminal_ssh_dialog.js';

/**
 * Path for pref with boolean crostini enabled.
 *
 * @type {string}
 */
const PREF_PATH_ENABLED = 'crostini.enabled';

/**
 * Path for pref with boolean ssh allowed.
 *
 * @type {string}
 */
const PREF_PATH_SSH_ALLOWED = 'crostini.terminal_ssh_allowed_by_policy';

/**
 * Path for pref with list of GuestOS containers.
 *
 * @type {string}
 */
const PREF_PATH_CONTAINERS = 'crostini.containers';

/**
 * If we're told what the name should be use that, otherwise container label is
 * <container_name> for termina, else <vm_name>:<container_name>.
 *
 * @param {{vm_name: string, container_name: string,
 *     terminal_label: ?string}} container
 * @return {string}
 */
function containerLabel(container) {
  if (container.terminal_label) {
    return container.terminal_label;
  }
  if (container.vm_name === DEFAULT_VM_NAME) {
     return container.container_name;
  }
  return `${container.vm_name}:${container.container_name}`;
}

export class TerminalHomeApp extends LitElement {
  /** @override */
  static get properties() {
    return {
      sshConnections: {state: true},
      containers: {state: true},
      crostiniEnabled: {state: true},
      sshAllowed: {state: true},
      settingsProfiles: {state: true},
      sshConnectionDeleteDialogTitle_: {state: true},
    };
  }

  /** @override */
  static get styles() {
    return css`
      :host {
        display: flex;
        flex-wrap: wrap;
        font-family: var(--cros-body-1-font-family);
        padding: 40px 0 0 0;
        justify-content: center;
      }

      a {
        text-decoration: none;
      }

      button {
        background: inherit;
        border: none;
        cursor: pointer;
        padding: 0;
        text-align: inherit;
      }

      h3 {
        color: rgb(var(--foreground-color-rgb));
        flex: 1;
        font-size: 13px;
        font-weight: 500;
        margin: 0;
      }

      .rowlabel {
        color: rgb(var(--foreground-color-rgb));
        flex: 1;
        font-size: 13px;
        font-weight: 400;
        margin: 16px 0;
        padding-right: 16px;
      }

      li:not(:last-child), .line {
        border-bottom: 1px solid rgb(var(--foreground-color-rgb), 0.14);
      }

      mwc-icon-button {
        --mdc-icon-button-size: 40px;
        --mdc-icon-size: 20px;
        --mdc-ripple-color: var(--background-color)
      }

      section {
        background-color: rgba(var(--foreground-color-rgb), 0.06);
        border-radius: 8px;
        margin: 0 8px 16px 8px;
        min-width: 256px;
      }

      terminal-button {
        --button-bg: inherit;
        --button-border-color: rgba(var(--foreground-color-rgb), 0.14);
        --button-focus-shadow-color: rgba(var(--button-color-rgb), 0.2);
        --button-hover-bg: rgba(var(--button-color-rgb), 0.2);
        --button-text-color: rgb(var(--button-color-rgb));
      }

      ul {
        list-style-type: none;
        margin: 0;
        padding: 0 10px 0 20px;
      }

      .button-icon > svg {
        fill: rgb(var(--button-color-rgb));
        height: 22px;
        margin: -6px 0;
      }

      .column {
        margin: 0 12px;
        max-width: 700px;
      }

      .header {
        height: 64px;
        padding: 0 20px;
      }

      .icon-fill-path > svg > path, .icon-fill-svg > svg {
        fill: rgb(var(--foreground-color-rgb));
      }

      .row {
        align-items: center;
        display: flex;
      }

      .full-width {
        width: 100%;
      }

      .nowrap {
        white-space: nowrap;
      }

      .row-icon > svg {
        height: 20px;
        padding: 0 16px 0 0;
      }

      .settings {
        flex: 1;
      }

      @media (min-width: 1036px) {
        .settings {
          max-width: 256px;
        }
      }

      .sublabel {
        color: rgba(var(--foreground-color-rgb), 0.8);
        font-size: 13px;
        font-weight: 500;
        margin: -10px 0 0 0;
        padding: 0 20px 20px 20px;
      }
    `;
  }

  constructor() {
    super();
    this.sshConnections = [];
    this.containers = [];
    this.crostiniEnabled = true;
    this.sshAllowed = true;
    this.settingsProfiles = [];
    this.sshConnectionDeleteDialogTitle_ = '';
    this.sshDeleteProfileId_ = '';

    this.sshConnectionMenuRef_ = createRef();

    window.storage.addObserver(this.onSettingsChanged.bind(this));
    this.onSettingsChanged({});

    const prefsChanged = this.onPrefsChanged.bind(this);
    const paths =
        [PREF_PATH_ENABLED, PREF_PATH_CONTAINERS, PREF_PATH_SSH_ALLOWED];
    if (chrome.terminalPrivate) {
      chrome.terminalPrivate.onPrefChanged.addListener(prefsChanged);
      chrome.terminalPrivate.getPrefs(paths, prefsChanged);
    } else {
      // Fallback for dev / testing.
      console.warn('chrome.terminalPrivate API not found.');
      const changed = () => window.storage.getItems(
        paths).then(prefsChanged);
      window.storage.addObserver(changed);
      changed();
    }
  }

  /** @return {!TemplateResult} */
  renderLinux() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);
    const sectionLabel = msg('TERMINAL_HOME_DEFAULT_LINUX_CONTAINER_LABEL');

    const buttonText = this.crostiniEnabled
      ? msg('TERMINAL_HOME_MANAGE') : msg('TERMINAL_HOME_SET_UP');

    const text = (c) => html`
      <span class="row-icon icon-fill-path">${ICON_LINUX}</span>
      <div class="rowlabel">${containerLabel(c)}</div>
      ${c.terminal_policy_disabled ? html`
        <span class="row-icon icon-fill-path"
            title="${msg(`TERMINAL_DISABLED_TOOLTIP`)}">
          ${ICON_DOMAIN}
        </span>
      ` : ''}
   `;
    const href = (c) => {
      const enc = encodeURIComponent;
      return `terminal.html?command=vmshell&settings_profile=${
          enc(c.settingsProfileId)
          }&args[]=${enc(`--vm_name=${c.vm_name}`)
          }&args[]=${enc(`--target_container=${c.container_name}`)}`;
    };
    const link = (c) => html`
      <a class="row full-width" target="_blank" href="${href(c)}">
        ${text(c)}
      </a>
    `;

    return html`
      <section>
        <div class="${this.containers.length ? 'line' : ''}">
          <div class="header row">
            <h3>${sectionLabel}</h3>
            <terminal-button autofocus @click="${this.onOpenSystemSettings}">
              <span class="button-icon">${ICON_OPEN_IN_NEW}</span>
              ${buttonText}
            </terminal-button>
          </div>
          ${when(!this.crostiniEnabled, () => html`
            <div class="sublabel">
              ${msg('TERMINAL_HOME_LINUX_NOT_ENABLED')}
            </div>
          `)}
        </div>
        ${when(this.containers.length > 0, () => html`
          <ul>
          ${this.containers.map((c) => html`
            <li class="row">
              ${c.terminal_policy_disabled ? text(c) : link(c)}
              ${when(this.settingsProfiles.length > 1, () => html`
                <mwc-icon-button
                    title="${msg('TERMINAL_HOME_EDIT_LINUX')}"
                    aria-label="${msg('TERMINAL_HOME_EDIT_LINUX')}"
                    class="icon-fill-svg"
                    @click="${(e) => this.openLinuxDialog(
                                 c.vshProfileId, containerLabel(c))}">
                  ${ICON_EDIT}
                </mwc-icon-button>
              `)}
            </li>
          `)}
          </ul>
        `)}
      </section>
    `;
  }

  /** @return {!TemplateResult} */
  renderSSH() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);
    const sectionLabel = msg('TERMINAL_HOME_SSH');

    let sublabel;
    if (!this.sshAllowed) {
      sublabel = msg('TERMINAL_HOME_SSH_DISABLED_BY_POLICY');
    } else if (this.sshConnections.length === 0) {
      sublabel = msg('TERMINAL_HOME_SSH_EMPTY');
    }

    const enc = encodeURIComponent;
    const href = (c, params = {}) => {
      return composeSshUrl({
        settingsProfileId: c.settingsProfileId,
        hash: `#profile-id:${enc(c.id)}`,
        ...params,
      });
    };

    const text = (c) => html`
      <span class="row-icon icon-fill-svg">${ICON_SSH}</span>
      <div class="rowlabel">${c.description}</div>
   `;
    return html`
      <section>
        <div class="${this.sshConnections.length ? 'line' : ''}">
          <div class="header row">
            <h3>${sectionLabel}</h3>
            <terminal-button @click="${(e) => this.openSSHDialog()}">
              <span class="button-icon">${ICON_PLUS}</span>
              ${msg('TERMINAL_HOME_ADD_SSH')}
            </terminal-button>
          </div>
          ${when(!!sublabel, () => html`
            <div class="sublabel">${sublabel}</div>
          `)}
        </div>
        ${when(this.sshConnections.length > 0, () => html`
          <ul>
          ${this.sshConnections.map((c) => html`
            <li class="row">
              ${when(this.sshAllowed, () => html`
                <a class="row full-width" target="_blank" href="${href(c)}">
                  ${text(c)}
                </a>
              `, () => text(c))}
              <mwc-icon-button
                  title="${msg('HTERM_OPTIONS_BUTTON_LABEL')}"
                  aria-label="${msg('HTERM_OPTIONS_BUTTON_LABEL')}"
                  class="icon-fill-svg"
                  @click="${(e) => this.showSSHMore(c, e)}">
                ${ICON_MORE_VERT}
              </mwc-icon-button>
            </li>
          `)}
          </ul>
        `)}
      </section>
    `;
  }

  /** @override */
  render() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);
    return html`
      <div class="column full-width">
        ${this.renderLinux()}
        ${this.renderSSH()}
      </div>
      <div class="column settings">
        <section>
          <ul>
            <li>
              <button class="row full-width"
                  @click="${this.onOpenTerminalSettings}">
                <span class="row-icon icon-fill-svg">${ICON_SETTINGS}</span>
                <div class="full-width nowrap rowlabel">
                  ${msg('TERMINAL_HOME_TERMINAL_SETTINGS')}
                </div>
              </button>
            </li>
            <li>
              <button class="row full-width"
                  @click="${this.onOpenSystemSettings}">
                <span class="row-icon icon-fill-svg">${ICON_CODE}</span>
                <div class="full-width nowrap rowlabel">
                  ${msg('TERMINAL_HOME_DEVELOPER_SETTINGS')}
                </div>
                <mwc-icon-button class="icon-fill-svg">
                  ${ICON_OPEN_IN_NEW}
                </mwc-icon-button>
              </button>
            </li>
          </ul>
        </section>
      </div>
      <terminal-linux-dialog @close=${this.updateVshProfiles_}>
      </terminal-linux-dialog>
      <terminal-ssh-dialog></terminal-ssh-dialog>
      <terminal-context-menu ${ref(this.sshConnectionMenuRef_)}>
      </terminal-context-menu>
      <terminal-dialog @close=${this.onSSHDeleteDialogClose}>
        <div slot="title">${this.sshConnectionDeleteDialogTitle_}</div>
      </terminal-dialog>
    `;
  }

  /**
   * Called when hterm settings change.
   *
   * @param {!Object} changes
   */
  onSettingsChanged(changes) {
    window.storage.getItems(null).then(async (items) => {
      const sshConnections = [];
      const ids = /** @type {!Array<string>} */(
          items['/nassh/profile-ids'] || []);
      for (const id of ids) {
        const description = items[`/nassh/profiles/${id}/description`];
        const settingsProfileId =
            items[`/nassh/profiles/${id}/terminal-profile`] ||
            hterm.Terminal.DEFAULT_PROFILE_ID;
        const mountPath = items[`/nassh/profiles/${id}/mount-path`] || '';
        if (description) {
          sshConnections.push({id, description, settingsProfileId, mountPath});
        }
      }
      this.sshConnections = sshConnections;
      this.settingsProfiles = await getProfileIds(ProfileType.HTERM);
    });
  }

  /**
   * Called when prefs change.
   *
   * @param {?Object} prefs
   */
  onPrefsChanged(prefs) {
    if (prefs.hasOwnProperty(PREF_PATH_CONTAINERS)) {
      this.containers =
          prefs[PREF_PATH_CONTAINERS].filter((c) => c.terminal_supported);
      this.updateVshProfiles_();
    }
    if (prefs.hasOwnProperty(PREF_PATH_ENABLED)) {
      this.crostiniEnabled = prefs[PREF_PATH_ENABLED];
    }
    if (prefs.hasOwnProperty(PREF_PATH_SSH_ALLOWED)) {
      this.sshAllowed = prefs[PREF_PATH_SSH_ALLOWED];
    }
  }

  /**
   * Sync vsh profiles with containers. Create new profiles if needed, and
   * delete any that do not match.
   *
   * @private
   */
  async updateVshProfiles_() {
    const enc = encodeURIComponent;
    const containerKey = (vm, container) => `${enc(vm)}:${enc(container)}`;
    const profiles = getVshProfiles();
    const containerMap = {};
    for (const c of this.containers) {
      const key = containerKey(c.vm_name, c.container_name);
      containerMap[key] = true;
      if (!profiles[key]) {
        profiles[key] = {};
      }
      if (!profiles[key]['terminal-profile']) {
        profiles[key]['terminal-profile'] = hterm.Terminal.DEFAULT_PROFILE_ID;
      }
      c.vshProfileId = key;
      c.settingsProfileId = profiles[key]['terminal-profile'];
    }

    // Delete any unused profiles.
    for (const key in profiles) {
      if (!containerMap[key]) {
        delete profiles[key];
      }
    }
    setVshProfiles(profiles);

    // Clean up any sync'd prefs for vsh.
    // TODO(joelhockey): Remove after M120.
    await cleanupVshSyncPrefs();
    this.requestUpdate();
  }

  /**
   * Open terminal settings page.
   */
  onOpenTerminalSettings() {
    chrome.terminalPrivate?.openOptionsPage(() => {});
  }

  /**
   * Open system settings page.
   */
  onOpenSystemSettings() {
    chrome.terminalPrivate?.openSettingsSubpage('crostini', () => {});
  }

  /**
   * Open the linux dialog to add new connection or edit existing ones.
   *
   * @param {string} vshProfileId
   * @param {string} title
   */
  openLinuxDialog(vshProfileId, title) {
    this.shadowRoot.querySelector('terminal-linux-dialog')
        .show(vshProfileId, title);
  }

  /**
   * Open the ssh dialog to add new connection or edit existing ones.
   *
   * @param {string=} nasshProfileId
   */
  openSSHDialog(nasshProfileId = '') {
    this.shadowRoot.querySelector('terminal-ssh-dialog').show(nasshProfileId);
  }

  /**
   * Open the ssh delete dialog to confirm deleting a connection.
   *
   * @param {{id, description, settingsProfileId}} sshConnection
   */
  openSSHDeleteDialog(sshConnection) {
    this.sshDeleteProfileId_ = sshConnection.id;
    this.sshConnectionDeleteDialogTitle_ = hterm.messageManager.get(
        'TERMINAL_SETTINGS_PROFILE_DELETE_DIALOG_TITLE',
        [sshConnection.description]);
    this.shadowRoot.querySelector('terminal-dialog').show();
  }

  /**
   * @param {!Event} event
   */
  onSSHDeleteDialogClose(event) {
    if (event.detail.accept) {
      deleteProfile(ProfileType.NASSH, this.sshDeleteProfileId_);
    }
  }

  /**
   * Show the ssh connection more context menu.
   *
   * @param {{id, description, settingsProfileId}} sshConnection
   * @param {!Event} event
   */
  showSSHMore(sshConnection, event) {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);
    const openTab = (params) => chrome.terminalPrivate.openWindow({
      url: composeSshUrl({
        settingsProfileId: sshConnection.settingsProfileId,
        hash: `#profile-id:${encodeURIComponent(sshConnection.id)}`,
        mountPath: sshConnection.mountPath,
        ...params,
      }),
      asTab: true,
    });

    const items = [{
      name: msg('TERMINAL_HOME_EDIT_SSH'),
      action: () => this.openSSHDialog(sshConnection.id),
    }];
    if (this.sshAllowed) {
      items.push(
          {
            name: msg('SFTP_CLIENT_BUTTON_LABEL'),
            action: () => openTab({isSftp: true}),
          },
          {
            name: msg('TERMINAL_HOME_MOUNT'),
            action: () => openTab({isMount: true}),
          });
    }
    items.push({
      name: msg('REMOVE_LABEL'),
      action: () => this.openSSHDeleteDialog(sshConnection),
    });

    this.sshConnectionMenuRef_.value.label = msg('HTERM_OPTIONS_BUTTON_LABEL');
    this.sshConnectionMenuRef_.value.items = items;
    const rect = event.target.getBoundingClientRect();
    this.sshConnectionMenuRef_.value.show({x: rect.left, y: rect.bottom});
  }
}

customElements.define('terminal-home-app', TerminalHomeApp);
