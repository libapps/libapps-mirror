// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-home-app.
 *
 * @suppress {moduleLoad}
 */

import {css, html, LitElement} from './lit.js';
import {DEFAULT_VM_NAME} from './terminal_common.js';
import {ICON_CODE, ICON_EDIT, ICON_LINUX, ICON_OPEN_IN_NEW, ICON_PLUS,
    ICON_SETTINGS, ICON_SSH} from './terminal_icons.js';
import {stylesVars} from './terminal_settings_styles.js';
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
 * Path for pref with list of crostini containers.
 *
 * @type {string}
 */
const PREF_PATH_CONTAINERS = 'crostini.containers';

export class TerminalHomeApp extends LitElement {
  /** @override */
  async performUpdate() {
    // A lot of elements in this page assume libdot has finished initialization.
    await window.libdotInitialized;
    super.performUpdate();
  }

  /** @override */
  static get properties() {
    return {
      sshConnections: {state: true},
      containers: {state: true},
      crostiniEnabled: {state: true},
      sshAllowed: {state: true},
    };
  }

  /** @override */
  static get styles() {
    return [stylesVars, css`
      :host {
        display: flex;
        flex-wrap: wrap;
        font-family: 'Roboto';
        padding: 40px 0 0 0;
        justify-content: center;
      }

      a {
        text-decoration: none;
      }

      button {
        background-color: inherit;
        border: 1px solid rgb(var(--foreground-color-rgb), 0.14);
        border-radius: 4px;
        color: rgb(var(--button-color-rgb));
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
        outline: none;
        padding: 7px 15px;
      }

      button:hover {
        background-color: rgba(var(--button-color-rgb), 0.2);
      }

      h3 {
        color: rgb(var(--foreground-color-rgb));
        flex: 1;
        font-size: 13px;
        font-weight: 500;
        margin: 0;
      }

      h4 {
        color: rgb(var(--foreground-color-rgb));
        flex: 1;
        font-size: 13px;
        font-weight: 400;
        padding-right: 16px;
      }

      li:not(:last-child), .line {
        border-bottom: 1px solid rgb(var(--foreground-color-rgb), 0.14);
      }

      section {
        background-color: rgba(var(--foreground-color-rgb), 0.06);
        border-radius: 8px;
        margin: 0 8px 16px 8px;
        min-width: 256px;
      }

      ul {
        list-style-type: none;
        margin: 0;
        padding: 0 0 0 20px;
      }

      .button-icon > svg {
        fill: rgb(var(--button-color-rgb));
        height: 22px;
        margin: -6px 0;
        padding: 0 8px 0 0;
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
        color: rgba(var(--foreground-color-rgb), 0.5);
        margin: -10px 0 0 0;
        padding: 0 20px 20px 20px;
      }
    `];
  }

  constructor() {
    super();
    this.sshConnections = [];
    this.containers = [];
    this.crostiniEnabled = true;
    this.sshAllowed = true;

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

    const label = (c) => {
      if (c.vm_name === DEFAULT_VM_NAME) {
        return c.container_name;
      }
      return `${c.vm_name}:${c.container_name}`;
    };
    const text = (c) => html`
      <span class="row-icon icon-fill-path">${ICON_LINUX}</span>
      <h4>${label(c)}</h4>
   `;
    const href = (c) => {
      if (!this.crostiniEnabled) {
        return '';
      }
      return `terminal.html?command=vmshell&args[]=${
          encodeURIComponent(`--vm_name=${c.vm_name}`)}&args[]=${
          encodeURIComponent(`--target_container=${c.container_name}`)}`;
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
            <button @click="${this.onOpenSystemSettings}">
              <span class="button-icon">${ICON_OPEN_IN_NEW}</span>
              ${buttonText}
            </button>
          </div>
          ${this.crostiniEnabled ? undefined : html`
            <h4 class="sublabel">${msg('TERMINAL_HOME_LINUX_NOT_ENABLED')}</h4>
          `}
        </div>
        ${this.containers.length === 0 ? undefined : html`
          <ul>
          ${this.containers.map((c) => html`
            <li class="row">
              ${this.crostiniEnabled ? link(c) : text(c)}
            </li>
          `)}
          </ul>
        `}
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
    const text = (c) => html`
      <span class="row-icon icon-fill-svg">${ICON_SSH}</span>
      <h4>${c.description}</h4>
   `;
    const link = (c) => html`
      <a class="row full-width" target="_blank"
          href="terminal_ssh.html#profile-id:${c.id}">
        ${text(c)}
      </a>
    `;

    return html`
      <section>
        <div class="${this.sshConnections.length ? 'line' : ''}">
          <div class="header row">
            <h3>${sectionLabel}</h3>
            <button autofocus @click="${(e) => this.openSSHDialog()}">
              <span class="button-icon">${ICON_PLUS}</span>
              ${msg('TERMINAL_HOME_ADD_SSH')}
            </button>
          </div>
          ${sublabel ? html`<h4 class="sublabel">${sublabel}</h4>` : undefined}
        </div>
        ${this.sshConnections.length === 0 ? undefined : html`
          <ul>
          ${this.sshConnections.map((c) => html`
            <li class="row">
              ${this.sshAllowed ? link(c) : text(c)}
              <a tabindex="0" aria-label="${msg('TERMINAL_HOME_EDIT_SSH')}"
                  @click="${(e) => this.openSSHDialog(c.id)}">
                <span class="row-icon icon-fill-svg">${ICON_EDIT}</span>
              </a>
            </li>
          `)}
          </ul>
        `}
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
              <a class="row full-width" href=""
                    @click="${this.onOpenTerminalSettings}">
                <span class="row-icon icon-fill-svg">${ICON_SETTINGS}</span>
                <h4 class="full-width nowrap">
                  ${msg('TERMINAL_HOME_TERMINAL_SETTINGS')}
                </h4>
              </a>
            </li>
            <li>
              <a class="row full-width" href=""
                    @click="${this.onOpenSystemSettings}">
                <span class="row-icon icon-fill-svg">${ICON_CODE}</span>
                <h4 class="full-width nowrap">
                  ${msg('TERMINAL_HOME_DEVELOPER_SETTINGS')}
                </h4>
                <span class="row-icon icon-fill-svg">${ICON_OPEN_IN_NEW}</span>
              </a>
            </li>
          </ul>
        </section>
      </div>
      <terminal-ssh-dialog></terminal-ssh-dialog>
    `;
  }

  /**
   * Called when hterm settings change.
   *
   * @param {!Object} changes
   */
  onSettingsChanged(changes) {
    window.storage.getItems(null).then((items) => {
      const sshConnections = [];
      const ids = /** @type {!Array<string>} */(
          items['/nassh/profile-ids'] || []);
      for (const id of ids) {
        const description = items[`/nassh/profiles/${id}/description`];
        if (description) {
          sshConnections.push({id, description});
        }
      }
      this.sshConnections = sshConnections;
    });
  }

  /**
   * Called when prefs change.
   *
   * @param {?Object} prefs
   */
  onPrefsChanged(prefs) {
    if (prefs.hasOwnProperty(PREF_PATH_CONTAINERS)) {
      this.containers = prefs[PREF_PATH_CONTAINERS];
    }
    if (prefs.hasOwnProperty(PREF_PATH_ENABLED)) {
      this.crostiniEnabled = prefs[PREF_PATH_ENABLED];
    }
    if (prefs.hasOwnProperty(PREF_PATH_SSH_ALLOWED)) {
      this.sshAllowed = prefs[PREF_PATH_SSH_ALLOWED];
    }
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
   * Open the ssh dialog to add new connection or edit existing ones.
   *
   * @param {string=} nasshProfileId
   */
  openSSHDialog(nasshProfileId = '') {
    this.shadowRoot.querySelector('terminal-ssh-dialog').show(nasshProfileId);
  }
}

customElements.define('terminal-home-app', TerminalHomeApp);
