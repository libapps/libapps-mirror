// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from './deps_local.concat.js';

import {TerminalLinuxDialog} from './terminal_linux_dialog.js';

import {ProfileType, setProfileIds, setProfileValues}
  from './terminal_profiles.js';

describe('terminal_linux_dialog.js', function() {
  beforeEach(async function() {
    window.storage = new lib.Storage.Memory();
    this.el = /** @type {!TerminalLinuxDialog} */(
        document.createElement('terminal-linux-dialog'));
    document.body.append(this.el);
    await this.el.updateComplete;
  });

  afterEach(function() {
    document.body.removeChild(this.el);
    delete window.storage;
  });

  it('shows-vsh-profile', async function() {
    await setProfileIds(ProfileType.HTERM, ['default', 'red']);
    await setProfileValues(ProfileType.VSH, 'test',
        {'description': 'penguin', 'terminal-profile': 'red'});
    this.el.show('test');
    await new Promise((resolve) => this.el.shadowRoot.querySelector(
        'terminal-dialog').addEventListener('open', resolve));
    await this.el.updateComplete;
    this.label = this.el.shadowRoot.querySelector('div[slot="title"]');
    assert.equal(this.label.innerText, 'penguin');
    this.dropdown = this.el.shadowRoot.querySelector('terminal-dropdown');
    assert.equal(2, this.dropdown.options.length);
    assert.equal(this.dropdown.value, 'red');
  });
});
