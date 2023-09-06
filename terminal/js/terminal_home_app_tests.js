// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Home App Element unit tests.
 */

import {lib} from '../../libdot/index.js';

import './terminal_home_app.js';

describe('terminal_home_app_tests.js', () => {
  beforeEach(function() {
    window.storage = new lib.Storage.Memory();
    this.el = /** @type {!Element} */ (
      document.createElement('terminal-home-app'));
    document.body.appendChild(this.el);

    // Returns h3 and h4 nodes after waiting for all updates to complete.
    this.getRowText = async () => {
      for (let i = 0; i < 3; i++) {
        await this.el.updateComplete;
      }
      return this.el.shadowRoot.querySelectorAll(
          'h3, h4, .rowlabel, .sublabel');
    };
  });

  afterEach(function() {
    document.body.removeChild(this.el);
    delete window.storage;
  });

  it('shows-ssh-connections-and-linux-containers', async function() {
    window.storage.setItems({
      '/nassh/profile-ids': ['p1', 'p2'],
      '/nassh/profiles/p1/description': 'ssh-connection-1',
      '/nassh/profiles/p2/description': 'ssh-connection-2',
      'crostini.enabled': true,
      'crostini.containers': [
        {
          vm_name: 'termina',
          container_name: 'penguin',
          terminal_supported: true,
        },
        {vm_name: 'termina', container_name: 'c2'},
        {vm_name: 'termina', container_name: 'c3', terminal_supported: false},
      ],
      'crostini.terminal_ssh_allowed_by_policy': true,
    });

    const rows = await this.getRowText();
    assert.equal(7, rows.length);
    assert.equal(
      'TERMINAL_HOME_DEFAULT_LINUX_CONTAINER_LABEL', rows[0].innerText);
    assert.equal('penguin', rows[1].innerText);
    assert.equal('TERMINAL_HOME_SSH', rows[2].innerText);
    assert.equal('ssh-connection-1', rows[3].innerText);
    assert.equal('ssh-connection-2', rows[4].innerText);
    assert.equal('TERMINAL_HOME_TERMINAL_SETTINGS', rows[5].innerText);
    assert.equal('TERMINAL_HOME_DEVELOPER_SETTINGS', rows[6].innerText);

    // One container and two ssh connections == 3 links
    const links = this.el.shadowRoot.querySelectorAll('li a .rowlabel');
    assert.equal(3, links.length);

    // Buttons for Add SSH, and Manage (Linux).
    const buttons = this.el.shadowRoot.querySelectorAll('terminal-button');
    assert.equal(2, buttons.length);
    assert.equal('TERMINAL_HOME_MANAGE', buttons[0].innerText.trim());
    assert.equal('TERMINAL_HOME_ADD_SSH', buttons[1].innerText.trim());
  });

  it('shows-sublabels', async function() {
    window.storage.setItems({
      '/nassh/profile-ids': [],
      'crostini.enabled': false,
      'crostini.terminal_ssh_allowed_by_policy': true,
    });

    const rows = await this.getRowText();
    assert.equal(6, rows.length);
    assert.equal(
      'TERMINAL_HOME_DEFAULT_LINUX_CONTAINER_LABEL', rows[0].innerText);
    assert.equal('TERMINAL_HOME_LINUX_NOT_ENABLED', rows[1].innerText);
    assert.equal('TERMINAL_HOME_SSH', rows[2].innerText);
    assert.equal('TERMINAL_HOME_SSH_EMPTY', rows[3].innerText);
    assert.equal('TERMINAL_HOME_TERMINAL_SETTINGS', rows[4].innerText);
    assert.equal('TERMINAL_HOME_DEVELOPER_SETTINGS', rows[5].innerText);

    // Buttons for Add SSH, and Manage (Linux).
    const buttons = this.el.shadowRoot.querySelectorAll('terminal-button');
    assert.equal(2, buttons.length);
    assert.equal('TERMINAL_HOME_SET_UP', buttons[0].innerText.trim());
    assert.equal('TERMINAL_HOME_ADD_SSH', buttons[1].innerText.trim());
  });

  it('removes-links-if-policy-disabled', async function() {
    window.storage.setItems({
      '/nassh/profile-ids': ['p1', 'p2'],
      '/nassh/profiles/p1/description': 'ssh-connection-1',
      '/nassh/profiles/p2/description': 'ssh-connection-2',
      'crostini.enabled': false,
      'crostini.containers': [
        {
          vm_name: 'termina',
          container_name: 'penguin',
          terminal_supported: true,
        },
      ],
      'crostini.terminal_ssh_allowed_by_policy': false,
    });

    const rows = await this.getRowText();
    assert.equal(9, rows.length);
    assert.equal(
      'TERMINAL_HOME_DEFAULT_LINUX_CONTAINER_LABEL', rows[0].innerText);
    assert.equal('TERMINAL_HOME_LINUX_NOT_ENABLED', rows[1].innerText);
    assert.equal('penguin', rows[2].innerText);
    assert.equal('TERMINAL_HOME_SSH', rows[3].innerText);
    assert.equal('TERMINAL_HOME_SSH_DISABLED_BY_POLICY', rows[4].innerText);
    assert.equal('ssh-connection-1', rows[5].innerText);
    assert.equal('ssh-connection-2', rows[6].innerText);
    assert.equal('TERMINAL_HOME_TERMINAL_SETTINGS', rows[7].innerText);
    assert.equal('TERMINAL_HOME_DEVELOPER_SETTINGS', rows[8].innerText);

    // Even though Crostini isn't enabled, we still have a container so should
    // have a link.
    const links = this.el.shadowRoot.querySelectorAll('li a .rowlabel');
    assert.equal(1, links.length);

    // Buttons for Add SSH, and Set up (Linux).
    const buttons = this.el.shadowRoot.querySelectorAll('terminal-button');
    assert.equal(2, buttons.length);
    assert.equal('TERMINAL_HOME_SET_UP', buttons[0].innerText.trim());
    assert.equal('TERMINAL_HOME_ADD_SSH', buttons[1].innerText.trim());
  });
});
