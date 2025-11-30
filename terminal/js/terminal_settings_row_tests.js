// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test for <terminal-settings-row>
 */

import './terminal_settings_row.js';

  beforeEach(async function() {
    this.expandableRow = document.createElement('terminal-settings-row');
    this.expandableRow.setAttribute('expandable', '');
    document.body.appendChild(this.expandableRow);

    this.expandEvents = [];
    this.expandableRow.addEventListener('expand', (e) => {
      this.expandEvents.push(e);
    });

    await this.expandableRow.updateComplete;
  });

  afterEach(function() {
    document.body.removeChild(this.expandableRow);
  });

  it('toggle expand state when clicked', async function() {
    const main = this.expandableRow.shadowRoot.querySelector('#main');

    assert.isFalse(this.expandableRow.expanded_);

    main.click();
    await this.expandableRow.updateComplete;

    assert.isTrue(this.expandableRow.expanded_);
    assert.equal(this.expandEvents.length, 1);
    assert.equal(this.expandEvents[0].detail, true);

    main.click();
    await this.expandableRow.updateComplete;

    assert.isFalse(this.expandableRow.expanded_);
    assert.equal(this.expandEvents.length, 2);
    assert.equal(this.expandEvents[1].detail, false);
  });
