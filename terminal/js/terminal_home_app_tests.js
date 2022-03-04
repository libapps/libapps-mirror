// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Home App Element unit tests.
 */

import {TerminalHomeApp} from './terminal_home_app.js';

describe('terminal_home_app_tests.js', () => {
  beforeEach(function() {
    hterm.defaultStorage.setItems({
      '/nassh/profile-ids': ['p1', 'p2'],
      '/nassh/profiles/p1/description': 'ssh-connection-1',
      '/nassh/profiles/p2/description': 'ssh-connection-2',
      'crostini.containers': [
        {vm_name: 'termina', container_name:'penguin'},
        {vm_name: 'termina', container_name:'c2'},
      ],
    });
    this.el = /** @type {!Element} */ (
      document.createElement(TerminalHomeApp.is));
    document.body.appendChild(this.el);
    return this.el.updateComplete;
  });

  afterEach(function() {
    document.body.removeChild(this.el);
  });

  it('shows-ssh-connections-and-linux-containers', async function() {
    // Extra await updateComplete due to multiple async calls for settings.
    await this.el.updateComplete;

    const rows = this.el.shadowRoot.querySelectorAll('li .text');
    assert.equal(5, rows.length);
    assert.equal('TERMINAL_HOME_MANAGE_SSH', rows[0].innerText);
    assert.equal('ssh-connection-1', rows[1].innerText);
    assert.equal('ssh-connection-2', rows[2].innerText);
    assert.equal('termina:penguin', rows[3].innerText);
    assert.equal('termina:c2', rows[4].innerText);
  });
});
