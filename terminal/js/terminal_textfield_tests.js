// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Unit tests for <terminal-textfield>
 */

import './terminal_textfield.js';

beforeEach(async function() {
  this.el = document.createElement('terminal-textfield');
  this.el.fitContent = true;
  this.el.value = 'hello';
  document.body.appendChild(this.el);
  await this.el.updateComplete;
  this.input = this.el.shadowRoot.querySelector('input');

  this.rulers = ['hello', 'hello world'].map((text) => {
    const span = document.createElement('span');
    span.textContent = text + 'XXX';
    document.body.appendChild(span);
    return span;
  });
});

afterEach(function() {
  document.body.removeChild(this.el);
  for (const el of this.rulers) {
    document.body.removeChild(el);
  }
});

it('set-focused', async function() {
  // By default the input is not focused.
  assert.isFalse(this.el.focused_);

  this.el.focus();
  await this.el.updateComplete;
  assert.isTrue(this.el.focused_);

  this.el.blur();
  await this.el.updateComplete;
  assert.isFalse(this.el.focused_);
});

it('pass-through-change-event', async function() {
  await new Promise((resolve) => {
    this.el.addEventListener('change', () => {
      resolve();
    });
    this.input.dispatchEvent(new Event('change'));
  });
});

it('set-input-value-on-value-change', async function() {
  this.el.value = 'hello world';
  await this.el.updateComplete;
  assert.equal(this.input.value, 'hello world');
});

it('fit-content', async function() {
  assert.equal(this.el.style.maxWidth, `${this.rulers[0].offsetWidth}px`);
  this.el.value = 'hello world';
  await this.el.updateComplete;
  assert.equal(this.el.style.maxWidth, `${this.rulers[1].offsetWidth}px`);
});
