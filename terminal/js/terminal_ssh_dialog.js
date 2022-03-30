// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Export an element: terminal-ssh-dialog
 */

import {LitElement, createRef, css, html, ref} from './lit.js';
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
 * Split a cmd string to an array of arguments. We do some very simple
 * dequoting here, similar to nassh.CommandInstance.splitCommandLine().
 *
 * @param {string} cmd
 * @return {!Array<string>}
 */
export function splitCommandLine(cmd) {
  const args = cmd.match(/("[^"]*"|\S+)/g) ?? [];
  // Remove double quotes at the beginning and end.
  return args.map((x) => x.replace(/(^"|"$)/g, ''));
}

/**
 * Extract the ssh destination from ssh arguments.
 *
 * @param {!Array<string>} sshArgs
 * @return {?string} The destination or null if it failed.
 */
export function extractSSHDestination(sshArgs) {
  let skipNext = false;
  for (const arg of sshArgs) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (!arg.startsWith('-')) {
      return arg;
    }

    // `arg` is an option. We needs to handle all these situations:
    //
    // - a flag option: e.g. '-4'
    // - an option that take a value in the next item in `sshArgs`: e.g. '-p'
    // - an option that take a value inplace: e.g. '-p22'
    // - a combination of flags, where the last one might take a value either
    //   inplace or not: e.g. '-4A', `-4Ap22`, or `-4Ap`  with the port number
    //   in the next value in `sshArgs`.
    for (let i = 1; i < arg.length; ++i) {
      if (SSH_FLAG_OPTIONS.includes(arg[i])) {
        continue;
      }
      // The option takes a value. If we have nothing left in `arg`, then the
      // value is in the next item in `sshArgs`.
      //
      // TODO(lxj): be stricter and check it against a list of known options?
      skipNext = i === (arg.length - 1);
      break;
    }
  }

  return null;
}

/**
 * @typedef {{
 *            user: string,
 *            hostname: string,
 *            port: ?number,
 *          }}
 */
export let ParsedDestination;

/**
 * @param {string} destination Either 'user@hostname' or
 *     'ssh://user@hostname[:port]'.
 * @return {?ParsedDestination} Return null if it failed.
 */
export function parseSSHDestination(destination) {
  // Match ssh://user@hostname[:port].
  const sshUrlMatch =
      destination.match(/^ssh:\/\/([^@]+)@([^:]+)(?::(\d+))?$/i);
  if (sshUrlMatch) {
    const [user, hostname, port] = sshUrlMatch.slice(1);
    return {
      user,
      hostname,
      port: port ? Number.parseInt(port, 10) : null,
    };
  }

  // Match user@hostname
  const match = destination.match(/^([^@]+)@([^:]+)$/);
  if (match) {
    const [user, hostname] = match.slice(1);
    return {user, hostname, port: null};
  }

  return null;
}

export class TerminalSSHDialog extends LitElement {
  /** @override */
  static get properties() {
    return {
      userTitle_: {
        attribute: false,
      },
      destination_: {
        attribute: false,
      },
    };
  }

  /** @override */
  static get styles() {
    return css`
        :host {
          --terminal-dialog-min-width: 500px;
        }

        terminal-textfield {
          margin-bottom: 16px;
        }

        #identity-container {
          display: flex;
          margin-bottom: 16px;
        }

        #identity-dropdown {
          flex-grow: 1;
          margin-right: 8px;
        }
    `;
  }

  constructor() {
    super();

    // The title manually set by the user.
    this.userTitle_ = '';
    /**
     * The ssh destination.
     *
     * @private {?string}
     */
    this.destination_ = null;

    this.relayArgsRef_ = createRef();
  }

  getTitle_() {
    if (this.userTitle_) {
      return this.userTitle_;
    }
    if (this.destination_) {
      return this.destination_;
    }
    return hterm.messageManager.get('TERMINAL_HOME_NEW_SSH_CONNECTION');
  }

  /** @override */
  render() {
    const msg = (id) => hterm.messageManager.get(id);

    // TODO(b/223076712): grab the actual identities.
    const identities = [{value: '[default]'}];
    return html`
        <terminal-dialog id="dialog">
          <div slot="title">
            <terminal-textfield blendIn fitContent value="${this.getTitle_()}"
                @change="${(e) => this.userTitle_ = e.target.value}">
            </terminal-textfield>
          </div>
          <terminal-textfield id="ssh-command"
              label="${msg('TERMINAL_HOME_SSH_COMMAND')}"
              @input="${this.onCommandUpdated_}"
              placeholder="username@hostname -p <port> -R 1234:localhost:5678">
            <span slot="inline-prefix">ssh&nbsp</span>
          </terminal-textfield>
          <terminal-label>${msg('IDENTITY_LABEL')}</terminal-label>
          <div id="identity-container">
            <terminal-dropdown
                id="identity-dropdown"
                .options="${identities}"
                .value="${identities[0].value}"></terminal-dropdown>
            <terminal-button>
              ${msg('TERMINAL_HOME_IMPORT_IDENTITY')}
            </terminal-button>
          </div>
          <terminal-textfield ${ref(this.relayArgsRef_)} id="relay-args"
              label="${msg('FIELD_NASSH_OPTIONS_PLACEHOLDER')}">
          </terminal-textfield>
        </terminal-dialog>
    `;
  }

  /** @param {!Event} e */
  onCommandUpdated_(e) {
    this.destination_ = extractSSHDestination(splitCommandLine(e.target.value));

    if (this.destination_) {
      // TODO(b/223076712): if we fail to parse the destination, maybe we should
      // show an error in the textfield.
      const parsed = parseSSHDestination(this.destination_);
      if (parsed && parsed.hostname.match(GOOGLE_HOST_REGEXP)) {
        const relayArgs = this.relayArgsRef_.value;
        // Add the google relay arg if it is not there already.
        if (!/(^|\s)--config=google\b/.test(relayArgs.value)) {
          relayArgs.value = `--config=google ${relayArgs.value}`;
        }
      }
    }
  }
}

customElements.define('terminal-ssh-dialog', TerminalSSHDialog);
