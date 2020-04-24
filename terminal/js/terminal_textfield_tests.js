// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Unit tests for <terminal-textfield>
 */

import './terminal_textfield.js';

describe('terminal_textfield_tests.js', () => {
  beforeEach(async function() {
    this.el = document.createElement('terminal-textfield');
    document.body.appendChild(this.el);
    await this.el.updateComplete;
    this.input = this.el.shadowRoot.querySelector('input');
    this.underline = this.el.shadowRoot.querySelector('#underline');
  });

  afterEach(function() {
    document.body.removeChild(this.el);
  });

  // 'change' event is tested separately. When we have more than one event to
  // test, we can turn this to a parametrized test.
  it('pass-through-keydown', async function() {
    const eventName = 'keydown';
    await new Promise((resolve) => {
      this.el.addEventListener(eventName, resolve);
      this.input.dispatchEvent(new Event(eventName));
    });
  });

  it('set-underline-focused', async function() {
    // By default the input is not focused.
    assert.isFalse(this.underline.hasAttribute('data-focused'));

    this.input.focus();
    await this.el.updateComplete;
    assert.isTrue(this.underline.hasAttribute('data-focused'));

    this.input.blur();
    await this.el.updateComplete;
    assert.isFalse(this.underline.hasAttribute('data-focused'));
  });

  it('set-value-and-pass-through-event-on-input-change', async function() {
    await new Promise((resolve) => {
      this.el.addEventListener('change', () => {
        assert.equal(this.el.value, 'hello world');
        resolve();
      });
      this.input.value = 'hello world';
      this.input.dispatchEvent(new Event('change'));
    });
  });

  it('set-input-value-on-value-change', async function() {
    this.el.value = 'hello world';
    await this.el.updateComplete;
    assert.equal(this.input.value, 'hello world');
  });
});
