// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-home-app.
 *
 * @suppress {moduleLoad}
 */

import {css, html, LitElement} from './lit_element.js';

/**
 * Path for pref with list of crostini CONTAINERS_PATH.
 *
 * @type {string}
 */
const CONTAINERS_PATH = 'crostini.containers';

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

      .icon-linux > svg > path, .icon-ssh > svg {
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

    const settingsChanged = (changes) => {
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
    };
    hterm.defaultStorage.addObserver(settingsChanged);
    settingsChanged({});

    const containersChanged = (prefs) => {
      if (prefs.hasOwnProperty(CONTAINERS_PATH)) {
        this.containers = prefs[CONTAINERS_PATH] || [];
      }
    };
    if (chrome.terminalPrivate) {
      chrome.terminalPrivate.onPrefChanged.addListener(containersChanged);
      chrome.terminalPrivate.getPrefs([CONTAINERS_PATH], containersChanged);
    } else {
      // Fallback for dev / testing.
      console.warn('chrome.terminalPrivate API not found.');
      const changed = () => hterm.defaultStorage.getItem(CONTAINERS_PATH).then(
        (item) => containersChanged({[CONTAINERS_PATH]: item}));
      hterm.defaultStorage.addObserver(changed);
      changed();
    }
  }

  /** @override */
  render() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);
    const containerHref = (c) => {
      return `terminal.html?command=vmshell&args[]=${
          encodeURIComponent(`--vm_name=${c['vm_name']}`)}&args[]=${
          encodeURIComponent(`--target_container=${c['container_name']}`)}`;
    };
    const containerText = (c) => `${c['vm_name']}:${c['container_name']}`;

    return html`
        <ul>
          <li>
            <a href="terminal_ssh.html">
              <span class="icon-ssh">${ICON_PLUS}</span>
              <span class="text">${msg('TERMINAL_HOME_MANAGE_SSH')}</span>
            </a>
          </li>
          ${this.sshConnections.map((c) => html`
              <li>
                <a href="terminal_ssh.html#profile-id:${c.id}">
                  <span class="icon-ssh">${(ICON_SSH)}</span>
                  <span class="text">${c.description}</span>
                </a>
              </li>
          `)}
          ${this.containers.map((c) => html`
              <li>
                <a href="${containerHref(c)}">
                  <span class="icon-linux">${(ICON_LINUX)}</span>
                  <span class="text">${containerText(c)}</span>
                </a>
              </li>
          `)}
        </ul>
    `;
  }
}

customElements.define(TerminalHomeApp.is, TerminalHomeApp);
