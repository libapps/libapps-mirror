// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-home-app.
 *
 * @suppress {moduleLoad}
 */

import {css, html, LitElement} from './lit_element.js';
import {DEFAULT_CONTAINER_NAME, DEFAULT_VM_NAME} from './terminal_common.js';

/**
 * Path for pref with boolean crostini enabled.
 *
 * @type {string}
 */
const PREF_PATH_ENABLED = 'crostini.enabled';

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
const ICON_SSH = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"/></svg>`;

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
const ICON_SETTINGS = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19.43 12.98c.04-.32.07-.64.07-.98 0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.09-.16-.26-.25-.44-.25-.06 0-.12.01-.17.03l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.06-.02-.12-.03-.18-.03-.17 0-.34.09-.43.25l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98 0 .33.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.09.16.26.25.44.25.06 0 .12-.01.17-.03l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.06.02.12.03.18.03.17 0 .34-.09.43-.25l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zm-1.98-1.71c.04.31.05.52.05.73 0 .21-.02.43-.05.73l-.14 1.13.89.7 1.08.84-.7 1.21-1.27-.51-1.04-.42-.9.68c-.43.32-.84.56-1.25.73l-1.06.43-.16 1.13-.2 1.35h-1.4l-.19-1.35-.16-1.13-1.06-.43c-.43-.18-.83-.41-1.23-.71l-.91-.7-1.06.43-1.27.51-.7-1.21 1.08-.84.89-.7-.14-1.13c-.03-.31-.05-.54-.05-.74s.02-.43.05-.73l.14-1.13-.89-.7-1.08-.84.7-1.21 1.27.51 1.04.42.9-.68c.43-.32.84-.56 1.25-.73l1.06-.43.16-1.13.2-1.35h1.39l.19 1.35.16 1.13 1.06.43c.43.18.83.41 1.23.71l.91.7 1.06-.43 1.27-.51.7 1.21-1.07.85-.89.7.14 1.13zM12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>`;

export class TerminalHomeApp extends LitElement {
  static get is() { return 'terminal-home-app'; }

  /** @override */
  async performUpdate() {
    // A lot of elements in this page assume libdot has finished initialization.
    await window.libdotInitialized;
    super.performUpdate();
  }

  /** @override */
  static get properties() {
    return {
      sshConnections: {
        type: Array,
      },
      containers: {
        type: Array,
      },
      crostiniEnabled: {
        type: Boolean,
      },
    };
  }

  /** @override */
  static get styles() {
    return css`
      a {
        align-items: center;
        display: flex;
        height: 100%;
        padding: 0 20px;
        text-decoration: none;
        width: 100%;
      }

      a:hover {
        background-color: var(--hterm-cursor-color);
      }

      li {
        height: 50px;
      }

      ul {
        list-style-type: none;
        padding-inline-start: unset;
      }

      svg {
        height: 32px;
        padding-right: 16px;
      }

      .icon-fill-path > svg > path, .icon-fill-svg > svg {
        fill: var(--hterm-foreground-color);
      }

      .text {
        color: var(--hterm-foreground-color);
        font-family: 'Roboto';
        font-size: 18px;
      }
    `;
  }

  constructor() {
    super();
    this.sshConnections = [];
    this.containers = [];
    this.crostiniEnabled = true;

    hterm.defaultStorage.addObserver(this.onSettingsChanged.bind(this));
    this.onSettingsChanged({});

    const prefsChanged = this.onPrefsChanged.bind(this);
    if (chrome.terminalPrivate) {
      chrome.terminalPrivate.onPrefChanged.addListener(prefsChanged);
      chrome.terminalPrivate.getPrefs(
          [PREF_PATH_ENABLED, PREF_PATH_CONTAINERS], prefsChanged);
    } else {
      // Fallback for dev / testing.
      console.warn('chrome.terminalPrivate API not found.');
      const changed = () => hterm.defaultStorage.getItems(
        [PREF_PATH_ENABLED, PREF_PATH_CONTAINERS]).then(prefsChanged);
      hterm.defaultStorage.addObserver(changed);
      changed();
    }
  }

  /** @override */
  render() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);
    const containers = this.crostiniEnabled ? this.containers : [];
    const containerHref = (c) => {
      return `terminal.html?command=vmshell&args[]=${
          encodeURIComponent(`--vm_name=${c.vm_name}`)}&args[]=${
          encodeURIComponent(`--target_container=${c.container_name}`)}`;
    };
    const containerText = (c) => {
      if (this.containers.length === 1 && c.vm_name === DEFAULT_VM_NAME &&
          c.container_name === DEFAULT_CONTAINER_NAME) {
        return msg('TERMINAL_HOME_DEFAULT_LINUX_CONTAINER_LABEL');
      }
      return `${c.vm_name}:${c.container_name}`;
    };

    return html`
        <ul>
          <li>
            <a href="terminal_ssh.html">
              <span class="icon-fill-svg">${ICON_PLUS}</span>
              <span class="text">${msg('TERMINAL_HOME_MANAGE_SSH')}</span>
            </a>
          </li>
          ${this.sshConnections.map((c) => html`
              <li>
                <a href="terminal_ssh.html#profile-id:${c.id}">
                  <span class="icon-fill-svg">${ICON_SSH}</span>
                  <span class="text">${c.description}</span>
                </a>
              </li>
          `)}
          ${containers.map((c) => html`
              <li>
                <a href="${containerHref(c)}">
                  <span class="icon-fill-path">${ICON_LINUX}</span>
                  <span class="text">${containerText(c)}</span>
                </a>
              </li>
          `)}
          ${this.crostiniEnabled ? undefined : html`
              <li>
                <a href="" @click="${this.onOpenSystemSettings}">
                  <span class="icon-fill-svg">${ICON_SETTINGS}</span>
                  <span class="text">
                    ${msg('TERMINAL_HOME_MANAGE_DEVELOPER_SETTINGS')}
                  </span>
                </a>
              </li>
          `}
        </ul>
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
  }

  /**
   * Open system settings page.
   */
  onOpenSystemSettings() {
    chrome.terminalPrivate?.openSettingsSubpage('crostini', () => {});
  }
}

customElements.define(TerminalHomeApp.is, TerminalHomeApp);
