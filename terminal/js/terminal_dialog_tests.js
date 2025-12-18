// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview dialog unit tests
 */

import './terminal_dialog.js';

beforeEach(async function() {
  this.el = document.createElement('terminal-dialog');
  document.body.appendChild(this.el);
  await this.el.updateComplete;
});

afterEach(function() {
  document.body.removeChild(this.el);
});

/**
 * @param {!HTMLElement} el
 * @param {string} classAttr
 */
function clickButton(el, classAttr) {
  el.shadowRoot.querySelector(
      `terminal-button.${classAttr}`).click();
}

it('shows-dialog', async function() {
  assert.isFalse(this.el.hasAttribute('open'));
  assert.isFalse(this.el.getNativeDialog_().hasAttribute('open'));

  this.el.show();
  await this.el.updateComplete;
  assert.isTrue(this.el.hasAttribute('open'));
  assert.isTrue(this.el.getNativeDialog_().hasAttribute('open'));
});

[
  {action: (el) => clickButton(el, 'action'), accept: true},
  {action: (el) => clickButton(el, 'cancel'), accept: false},
  // Simulate the user pressing <esc> on the dialog. In which case, the native
  // dialog is closed directly. And we should treat it as if the cancel button
  // is clicked.
  {action: (el) => el.getNativeDialog_().close(), accept: false},
].forEach(({action, accept}, i) => it(`closes-dialog-${i}`, async function() {
  this.el.show();
  await this.el.updateComplete;

  await new Promise((resolve) => {
    this.el.addEventListener('close', async (event) => {
      assert.equal(event.detail.accept, accept);
      await this.el.updateComplete;
      assert.isFalse(this.el.hasAttribute('open'));
      assert.isFalse(this.el.getNativeDialog_().hasAttribute('open'));
      resolve();
    });

    action(this.el);
  });
}));
