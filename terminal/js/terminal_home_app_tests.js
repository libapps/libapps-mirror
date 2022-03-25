// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Home App Element unit tests.
 */

import './terminal_home_app.js';

describe('terminal_home_app_tests.js', () => {
  beforeEach(function() {
    hterm.defaultStorage.clear();
    this.el = /** @type {!Element} */ (
      document.createElement('terminal-home-app'));
    document.body.appendChild(this.el);

    // Returns 'li .text' nodes after waiting for all updates to complete.
    this.getRowText = async () => {
      for (let i = 0; i < 3; i++) {
        await this.el.updateComplete;
      }
      return this.el.shadowRoot.querySelectorAll('h3, h4');
    };
  });

  afterEach(function() {
    document.body.removeChild(this.el);
  });

  it('shows-ssh-connections-and-linux-containers', async function() {
    hterm.defaultStorage.setItems({
      '/nassh/profile-ids': ['p1', 'p2'],
      '/nassh/profiles/p1/description': 'ssh-connection-1',
      '/nassh/profiles/p2/description': 'ssh-connection-2',
      'crostini.enabled': true,
      'crostini.containers': [
        {vm_name: 'termina', container_name:'penguin'},
        {vm_name: 'termina', container_name:'c2'},
      ],
    });

    const rows = await this.getRowText();
    assert.equal(8, rows.length);
    assert.equal('TERMINAL_HOME_SSH', rows[0].innerText);
    assert.equal('ssh-connection-1', rows[1].innerText);
    assert.equal('ssh-connection-2', rows[2].innerText);
    assert.equal(
      'TERMINAL_HOME_DEFAULT_LINUX_CONTAINER_LABEL', rows[3].innerText);
    assert.equal('termina:penguin', rows[4].innerText);
    assert.equal('termina:c2', rows[5].innerText);
    assert.equal('TERMINAL_HOME_TERMINAL_SETTINGS', rows[6].innerText);
    assert.equal('TERMINAL_HOME_DEVELOPER_SETTINGS', rows[7].innerText);
  });

  it('shows-linux-label-if-only-default-container', async function() {
    hterm.defaultStorage.setItems({
      'crostini.enabled': true,
      'crostini.containers': [
        {vm_name: 'termina', container_name:'penguin'},
      ],
    });

    const rows = await this.getRowText();
    assert.equal(5, rows.length);
    assert.equal('TERMINAL_HOME_SSH', rows[0].innerText);
    assert.equal(
      'TERMINAL_HOME_DEFAULT_LINUX_CONTAINER_LABEL', rows[1].innerText);
    assert.equal(
      'TERMINAL_HOME_DEFAULT_LINUX_CONTAINER_LABEL', rows[2].innerText);
    assert.equal('TERMINAL_HOME_TERMINAL_SETTINGS', rows[3].innerText);
    assert.equal('TERMINAL_HOME_DEVELOPER_SETTINGS', rows[4].innerText);
  });

  it('hides-containers-if-crostini-disabled', async function() {
    hterm.defaultStorage.setItems({
      'crostini.enabled': false,
      'crostini.containers': [
        {vm_name: 'termina', container_name:'penguin'},
      ],
    });

    const rows = await this.getRowText();
    assert.equal(3, rows.length);
    assert.equal('TERMINAL_HOME_SSH', rows[0].innerText);
    assert.equal('TERMINAL_HOME_TERMINAL_SETTINGS', rows[1].innerText);
    assert.equal('TERMINAL_HOME_DEVELOPER_SETTINGS', rows[2].innerText);
  });
});
