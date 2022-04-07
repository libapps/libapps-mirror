// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-home-app.
 *
 * @suppress {moduleLoad}
 */

import {css, html, LitElement} from './lit.js';
import {DEFAULT_CONTAINER_NAME, DEFAULT_VM_NAME} from './terminal_common.js';

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

/**
 * Plus svg icon.
 *
 * @type {!TemplateResult}
 */
const ICON_PLUS = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;

/**
 * SSH terminal svg icon.
 *
 * @type {!TemplateResult}
 */
const ICON_SSH = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M17.5 3H2.5C1.6 3 1 3.7 1 4.55556V13.5C1 14.3556 1.6 15 2.5 15H7H8V16H6V18H14V16H12V15H13H17.5C18.4 15 19 14.3556 19 13.5V4.5C19 3.64444 18.4 3 17.5 3ZM17 13H3V5H17V13Z"/></svg>`;

/**
 * Linux crostini penguin svg icon.
 *
 * @type {!TemplateResult}
 */
const ICON_LINUX = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M10 2c3.5056 0 5.577 2.592 6.4291 6.1657.3863.1221 1.1212.614 1.3405 1.2813.272.8277.4387 1.756-.303 2.0339-.259.097-.484.0798-.6816-.0231-.039 2.8879-1.2964 4.5267-3.258 5.335.0314.0621.0473.1343.0473.215 0 .548.2595.9922-1.6433.9922-1.3916 0-1.6266-.3033-1.6525-.6327-.0922-.0576-.185-.147-.2785-.147-.0938 0-.187.0969-.2796.1565C9.6922 17.701 9.4507 18 8.069 18c-1.9028 0-1.6433-.4443-1.6433-.9923a.5075.5075 0 0 1 .0483-.2223c-1.9598-.8128-3.216-2.4596-3.2589-5.3276-.1976.1029-.4226.1202-.6817.023-.7417-.2778-.575-1.2061-.303-2.0338.2252-.6854.9945-1.1858 1.3712-1.2905C4.4784 4.7036 6.5356 2 10 2zm0 3.7422c-.7017 0-1.212-1.5733-1.786-1.4287-1.9986.5034-3.1894 3.3091-3.1894 6.0963 0 3.3466 1.3186 5.1488 4.9754 5.1488 3.6568 0 4.9754-1.6023 4.9754-5.1488 0-2.9427-1.1993-5.6451-3.1894-6.0963-.6378-.1446-1.0843 1.4287-1.786 1.4287zm-.1677 3.3802a.3843.3843 0 0 1 .3174-.0006l1.1359.5122c.1967.0887.2854.3226.198.5224a.3965.3965 0 0 1-.0693.1073l-1.1293 1.2477a.3855.3855 0 0 1-.5746-.0008l-1.1256-1.2509a.4002.4002 0 0 1 .0248-.5592.3892.3892 0 0 1 .1036-.069zm-2.315-2.161c.457 0 .8275.3808.8275.8506 0 .4697-.3705.8505-.8276.8505-.457 0-.8275-.3808-.8275-.8505 0-.4698.3705-.8506.8275-.8506zm4.9655 0c.457 0 .8275.3808.8275.8506 0 .4697-.3705.8505-.8275.8505-.4571 0-.8276-.3808-.8276-.8505 0-.4698.3705-.8506.8276-.8506z"/></svg>`;

/**
 * Settings svg icon.
 *
 * @type {!TemplateResult}
 */
const ICON_SETTINGS = html`<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M11.5 18.0H8.5C7.9 18.0 7.4 17.6 7.4 17.0L7.1 15.5C6.9 15.4 6.7 15.3 6.5 15.2L5.1 15.7C4.5 15.9 3.9 15.7 3.6 15.2L2.2 12.8C1.9 12.2 2.0 11.6 2.4 11.3L3.7 10.4C3.7 10.2 3.7 10.1 3.7 10.0C3.7 9.9 3.7 9.8 3.7 9.6L2.5 8.7C2.0 8.4 1.9 7.7 2.2 7.2L3.6 4.7C3.9 4.3 4.5 4.0 5.1 4.3L6.5 4.8C6.7 4.7 6.9 4.6 7.1 4.5L7.4 3.0C7.4 2.4 7.9 2.0 8.5 2.0H11.5C12.1 2.0 12.6 2.4 12.6 3.0L12.8 4.5C13.1 4.6 13.3 4.7 13.5 4.8L14.9 4.3C15.5 4.1 16.1 4.3 16.4 4.8L17.8 7.3C18.1 7.8 18.0 8.4 17.6 8.7L16.3 9.7C16.3 9.8 16.4 9.9 16.4 10.0C16.4 10.1 16.3 10.3 16.3 10.4L17.6 11.3C18.0 11.7 18.1 12.3 17.9 12.8L16.4 15.3C16.1 15.8 15.5 16.0 14.9 15.8L13.5 15.2C13.3 15.3 13.1 15.4 12.9 15.6L12.6 17.0C12.6 17.6 12.1 18.0 11.5 18.0ZM8.9 16.0H11.1L11.3 14.1L11.7 14.0C12.1 13.9 12.4 13.7 12.8 13.4L13.1 13.2L14.9 13.9L16.0 12.1L14.4 11.0L14.5 10.6C14.5 10.4 14.5 10.2 14.5 10.0C14.5 9.8 14.5 9.6 14.5 9.4L14.4 9.0L16.0 7.9L14.9 6.1L13.1 6.8L12.8 6.6C12.4 6.3 12.1 6.2 11.7 6.0L11.3 5.9L11.1 4.0H8.9L8.7 5.9L8.3 6.0C7.9 6.1 7.6 6.3 7.2 6.6L6.9 6.8L5.1 6.1L4.0 7.9L5.6 9.0L5.5 9.4C5.5 9.6 5.5 9.8 5.5 10.0C5.5 10.2 5.5 10.4 5.5 10.6L5.6 11.0L4.0 12.1L5.1 13.9L6.9 13.2L7.2 13.4C7.6 13.7 7.9 13.8 8.3 14.0L8.7 14.1L8.9 16.0ZM10.0 12.5C11.4 12.5 12.5 11.4 12.5 10.0C12.5 8.6 11.4 7.5 10.0 7.5C8.6 7.5 7.5 8.6 7.5 10.0C7.5 11.4 8.6 12.5 10.0 12.5Z"/></svg>`;

/**
 * Edit svg icon.
 *
 * @type {!TemplateResult}
 */
const ICON_EDIT = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M17.4 3.9L16 2.6C15.3 1.8 14 1.8 13.2 2.6L10.4 5.4L2 13.8V18H6.2L17.4 6.8C18.2 6 18.2 4.7 17.4 3.9ZM4 16V14.6L11.8 6.8L13.2 8.2L5.4 16L4 16Z"/></svg>`;

/**
 * Code / Developers svg icon.
 *
 * @type {!TemplateResult}
 */
const ICON_CODE = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M8.2 6.2L4.4 10L8.2 13.8L6.8 15.2L1.6 10L6.8 4.8L8.2 6.2Z M11.3 13.8L15.1 10L11.3 6.2L12.7 4.8L17.9 10L12.7 15.2L11.3 13.8Z"/></svg>`;

/**
 * Open in new window svg icon.
 *
 * @type {!TemplateResult}
 */
const ICON_OPEN_IN_NEW = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M15 15H5V5H9V3H5C4 3 3 4 3 5C3 6 3 15 3 15C3 16 4 17 5 17H15C16 17 17 16 17 15V11H15V15ZM11 3V5H13.5L7 11.5L8.5 13L15 6.5V9H17V3H11Z"/></svg>`;

/**
 * Domain (enterprise policy) svg icon.
 *
 * @type {function(string):!TemplateResult}
 */
const domainIcon = (title) => html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>${title}</title><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>`;

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
    return css`
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
    `;
  }

  constructor() {
    super();
    this.sshConnections = [];
    this.containers = [];
    this.crostiniEnabled = true;
    this.sshAllowed = true;

    hterm.defaultStorage.addObserver(this.onSettingsChanged.bind(this));
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
      const changed = () => hterm.defaultStorage.getItems(
        paths).then(prefsChanged);
      hterm.defaultStorage.addObserver(changed);
      changed();
    }
  }

  /** @override */
  render() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);
    const sshLabel = msg('TERMINAL_HOME_SSH');
    const linuxLabel = msg('TERMINAL_HOME_DEFAULT_LINUX_CONTAINER_LABEL');

    const disabledIcon = (msgname) => html`
      <span class="row-icon icon-fill-svg">
        ${domainIcon(msg(msgname))}
      </span>
    `;
    const sshDisabled = disabledIcon('TERMINAL_HOME_SSH_DISABLED_BY_POLICY');
    const linuxDisabled = disabledIcon('TERMINAL_HOME_LINUX_NOT_ENABLED');

    const sshText = (c) => html`
      <span class="row-icon icon-fill-svg">${ICON_SSH}</span>
      <h4>${c.description}</h4>
   `;
    const sshLink = (c) => html`
      <a class="row full-width" target="_blank"
          href="terminal_ssh.html#profile-id:${c.id}">
        ${sshText(c)}
      </a>
    `;

    const containerLabel = (c) => {
      if (this.containers.length === 1 && c.vm_name === DEFAULT_VM_NAME &&
          c.container_name === DEFAULT_CONTAINER_NAME) {
        return msg('TERMINAL_HOME_DEFAULT_LINUX_CONTAINER_LABEL');
      }
      return `${c.vm_name}:${c.container_name}`;
    };
    const containerText = (c) => html`
      <span class="row-icon icon-fill-path">${ICON_LINUX}</span>
      <h4>${containerLabel(c)}</h4>
   `;
    const containerHref = (c) => {
      if (!this.crostiniEnabled) {
        return '';
      }
      return `terminal.html?command=vmshell&args[]=${
          encodeURIComponent(`--vm_name=${c.vm_name}`)}&args[]=${
          encodeURIComponent(`--target_container=${c.container_name}`)}`;
    };
    const containerLink = (c) => html`
      <a class="row" target="_blank" href="${containerHref(c)}">
        ${containerText(c)}
      </a>
    `;

    return html`
      <div class="column full-width">
        <section>
          <div class="header row ${this.sshConnections.length ? 'line' : ''}">
            <h3>${sshLabel}</h3>
            ${this.sshAllowed ? undefined : sshDisabled}
            <a target="_blank" href="terminal_ssh.html" autofocus>
              <button tabindex="-1">
                <span class="button-icon">${ICON_PLUS}</span>
                ${msg('TERMINAL_HOME_ADD_SSH')}
              </button>
            </a>
          </div>
          <ul>
          ${this.sshConnections.map((c) => html`
            <li class="row">
              ${this.sshAllowed ? sshLink(c) : sshText(c)}
              <a target="_blank" href="terminal_ssh.html"
                  aria-label="${msg('TERMINAL_HOME_EDIT_SSH')}">
                <span class="row-icon icon-fill-svg">${ICON_EDIT}</span>
              </a>
            </li>
          `)}
          </ul>
        </section>
        <section>
          <div class="header row ${this.containers.length ? 'line' : ''}">
            <h3>${linuxLabel}</h3>
            ${this.crostiniEnabled ? undefined : linuxDisabled}
          </div>
          <ul>
          ${this.containers.map((c) => html`
            <li class="row">
              ${this.crostiniEnabled ? containerLink(c) : containerText(c)}
            </li>
          `)}
          </ul>
        </section>
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
    `;
  }

  /**
   * Called when hterm settings change.
   *
   * @param {!Object} changes
   */
  onSettingsChanged(changes) {
    hterm.defaultStorage.getItems(null).then((items) => {
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
}

customElements.define('terminal-home-app', TerminalHomeApp);
