// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Dropdown Element unit tests.
 */

import {TerminalSettingsDropdownElement} from './terminal_settings_dropdown.js';

describe('terminal_settings_dropdown_tests.js', () => {
  const preference = 'terminal_settings_dropdown_tests_preference';
  const options = ['opt1', 'opt2', 'opt3'];

  before(function() {
    if (customElements.get(TerminalSettingsDropdownElement.is) === undefined) {
      customElements.define(
          TerminalSettingsDropdownElement.is,
          TerminalSettingsDropdownElement);
    }
  });

  beforeEach(function() {
    window.PreferenceManager = {
      defaultPreferences: {
        [preference]: {type: options},
      }
    };
    window.preferenceManager =
      new lib.PreferenceManager(new lib.Storage.Memory());
    window.preferenceManager.definePreference(preference, options[0]);

    this.el = /** @type {!TerminalSettingsDropdownElement} */ (
        document.createElement('terminal-settings-dropdown'));
    this.el.setAttribute('preference', preference);
    document.body.appendChild(this.el);

    // The element renders asynchronously.
    return this.el.updateComplete;
  });

  afterEach(function() {
    document.body.removeChild(this.el);

    delete window.preferenceManager;
    delete window.PreferenceManager;
  });

  it('updates-ui-when-preference-changes', async function() {
    assert.equal(window.preferenceManager.get(preference), options[0]);
    assert.equal(this.el.value, options[0]);

    await window.preferenceManager.set(preference, options[1]);
    assert.equal(this.el.value, options[1]);

    await window.preferenceManager.set(preference, options[2]);
    assert.equal(this.el.value, options[2]);
  });

  it('updates-preference-when-ui-changes', async function() {
    assert.equal(window.preferenceManager.get(preference), options[0]);
    assert.equal(this.el.value, options[0]);

    let prefChanged = test.listenForPrefChange(
        window.preferenceManager, preference);
    this.el.shadowRoot.querySelector('.option[option-index="1"]').click();
    await prefChanged;
    assert.equal(window.preferenceManager.get(preference), options[1]);

    prefChanged = test.listenForPrefChange(
        window.preferenceManager, preference);
    this.el.shadowRoot.querySelector('.option[option-index="2"]').click();
    await prefChanged;
    assert.equal(window.preferenceManager.get(preference), options[2]);
  });

  it('expands-and-collapses-options-list-when-clicked', async function() {
    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'false');

    this.el.click();
    await this.el.updateComplete;

    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'true');

    this.el.click();
    await this.el.updateComplete;

    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'false');
  });

  it('closes-options-list-when-option-clicked', async function() {
    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'false');

    this.el.click();
    await this.el.updateComplete;

    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'true');

    this.el.shadowRoot.querySelector('.option[option-index="1"]').click();
    await this.el.updateComplete;

    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'false');
  });

  it('closes-options-list-when-element-looses-focus', async function() {
    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'false');

    // Programmatically clicking the element doesn't focus it. So explicitly
    // focus it to get it into the correct state.
    this.el.focus();
    this.el.click();
    await this.el.updateComplete;

    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'true');

    this.el.blur();
    await this.el.updateComplete;

    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'false');
  });

  it('expands-and-collapses-options-list-when-enter-pressed', async function() {
    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'false');

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'Enter'}));
    await this.el.updateComplete;

    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'true');

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'Enter'}));
    await this.el.updateComplete;

    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'false');
  });

  it('collapses-options-list-when-escape-pressed', async function() {
    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'false');

    this.el.click();
    await this.el.updateComplete;

    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'true');

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'Escape'}));
    await this.el.updateComplete;

    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'false');

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'Escape'}));
    await this.el.updateComplete;

    // Escape on a contracted dropdown has no affect.
    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'false');
  });

  it('expands-options-list-when-space-pressed', async function() {
    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'false');

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'Space'}));
    await this.el.updateComplete;

    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'true');

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'Space'}));
    await this.el.updateComplete;

    // Space on an expanded dropdown has no affect.
    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'true');
  });

  it('selects-first-option-list-when-page-up-pressed', async function() {
    await window.preferenceManager.set(preference, options[2]);
    assert.equal(this.el.value, options[2]);

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'PageUp'}));
    await this.el.updateComplete;

    assert.equal(this.el.value, options[0]);
  });

  it('selects-first-option-when-home-pressed', async function() {
    await window.preferenceManager.set(preference, options[2]);
    assert.equal(this.el.value, options[2]);

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'Home'}));
    await this.el.updateComplete;

    assert.equal(this.el.value, options[0]);
  });

  it('selects-last-option-when-page-down-pressed', async function() {
    assert.equal(this.el.value, options[0]);

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'PageDown'}));
    await this.el.updateComplete;

    assert.equal(this.el.value, options[2]);
  });

  it('selects-last-option-when-end-pressed', async function() {
    assert.equal(this.el.value, options[0]);

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'End'}));
    await this.el.updateComplete;

    assert.equal(this.el.value, options[2]);
  });

  it('selects-previous-option-when-left-arrow-pressed', async function() {
    await window.preferenceManager.set(preference, options[2]);
    assert.equal(this.el.value, options[2]);

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowLeft'}));
    await this.el.updateComplete;

    assert.equal(this.el.value, options[1]);

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowLeft'}));
    await this.el.updateComplete;

    assert.equal(this.el.value, options[0]);

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowLeft'}));
    await this.el.updateComplete;

    // ArrowLeft when first element is selected has no effect.
    assert.equal(this.el.value, options[0]);
  });

  it('selects-previous-option-when-up-arrow-pressed', async function() {
    await window.preferenceManager.set(preference, options[2]);
    assert.equal(this.el.value, options[2]);

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowUp'}));
    await this.el.updateComplete;

    assert.equal(this.el.value, options[1]);

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowUp'}));
    await this.el.updateComplete;

    assert.equal(this.el.value, options[0]);

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowUp'}));
    await this.el.updateComplete;

    // ArrowUp when first element is selected has no effect.
    assert.equal(this.el.value, options[0]);
  });

  it('selects-next-option-when-right-arrow-pressed', async function() {
    assert.equal(this.el.value, options[0]);

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowRight'}));
    await this.el.updateComplete;

    assert.equal(this.el.value, options[1]);

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowRight'}));
    await this.el.updateComplete;

    assert.equal(this.el.value, options[2]);

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowRight'}));
    await this.el.updateComplete;

    // ArrowRight when last element is selected has no effect.
    assert.equal(this.el.value, options[2]);
  });

  it('selects-next-option-when-down-arrow-pressed', async function() {
    assert.equal(this.el.value, options[0]);

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowDown'}));
    await this.el.updateComplete;

    assert.equal(this.el.value, options[1]);

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowDown'}));
    await this.el.updateComplete;

    assert.equal(this.el.value, options[2]);

    this.el.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowDown'}));
    await this.el.updateComplete;

    // ArrowDown when last element is selected has no effect.
    assert.equal(this.el.value, options[2]);
  });
});
