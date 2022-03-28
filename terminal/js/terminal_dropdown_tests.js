// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Dropdown Element unit tests.
 */

import {TerminalSettingsDropdownElement} from './terminal_dropdown.js';

describe('terminal_dropdown_tests.js', () => {
  const preference = 'terminal_dropdown_tests_preference';
  const createOptions = () => [
    {value: 'opt1'},
    {value: 'opt2'},
    {value: 'opt3'},
  ];
  const options = createOptions();

  beforeEach(function() {
    window.preferenceManager =
      new lib.PreferenceManager(new lib.Storage.Memory());
    window.preferenceManager.definePreference(preference, options[0].value);

    this.el = /** @type {!TerminalSettingsDropdownElement} */ (
        document.createElement('terminal-settings-dropdown'));
    this.el.setAttribute('preference', preference);
    this.el.options = createOptions();
    document.body.appendChild(this.el);

    this.getNthLiElement = function(index) {
      return this.el.shadowRoot.querySelector(
          // CSS use 1-based index.
          `.option:nth-of-type(${index + 1})`);
    };

    // The element renders asynchronously.
    return this.el.updateComplete;
  });

  afterEach(function() {
    document.body.removeChild(this.el);

    delete window.preferenceManager;
  });

  it('updates-ui-when-preference-changes', async function() {
    assert.equal(window.preferenceManager.get(preference), options[0].value);
    assert.equal(this.el.value, options[0].value);

    await window.preferenceManager.set(preference, options[1].value);
    assert.equal(this.el.value, options[1].value);

    await window.preferenceManager.set(preference, options[2].value);
    assert.equal(this.el.value, options[2].value);
  });

  it('updates-preference-when-options-clicked', async function() {
    assert.equal(window.preferenceManager.get(preference), options[0].value);
    assert.equal(this.el.value, options[0].value);

    let prefChanged = test.listenForPrefChange(
        window.preferenceManager, preference);
    this.getNthLiElement(1).click();
    await prefChanged;
    assert.equal(window.preferenceManager.get(preference), options[1].value);

    prefChanged = test.listenForPrefChange(
        window.preferenceManager, preference);
    this.getNthLiElement(2).click();
    await prefChanged;
    assert.equal(window.preferenceManager.get(preference), options[2].value);
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

    this.getNthLiElement(1).click();
    await this.el.updateComplete;

    assert.equal(this.el.shadowRoot.querySelector('#container')
        .getAttribute('aria-expanded'), 'false');
  });

  // Unlike other tests that can wait for something to happen after a click, we
  // have nothing to wait for in this caes, so instead we directly test the
  // private function `onItemClickedHandler_()`.
  it('does-nothing-when-disabled-options-clicked', async function() {
    const newOptions = createOptions();
    newOptions[0].disabled = true;
    this.el.options = newOptions;
    await this.el.updateComplete;
    this.el.value = 'opt3';

    this.el.expanded = true;

    // Clicking a disabled item should do nothing.
    this.el.onItemClickedHandler_(0)(new MouseEvent('click'));
    assert.equal(this.el.value, 'opt3');
    assert.equal(this.el.expanded, true, 'dropdown should not be closed');

    // Clicking a enabled item should do the thing.
    this.el.onItemClickedHandler_(1)(new MouseEvent('click'));
    assert.equal(this.el.value, 'opt2');
    assert.equal(this.el.expanded, false);
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

  ['PageUp', 'Home'].forEach((keyCode) => it(
      `selects-first-enabled-option-when-${keyCode}-pressed`,
      async function() {
        await window.preferenceManager.set(preference, options[2].value);
        assert.equal(this.el.value, options[2].value);

        this.el.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;

        assert.equal(this.el.value, options[0].value);

        // Let's disable the first item, then the second item should be
        // selected.
        const newOptions = createOptions();
        newOptions[0].disabled = true;
        this.el.options = newOptions;
        await this.el.updateComplete;

        this.el.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;

        assert.equal(this.el.value, newOptions[1].value);
      },
  ));

  ['PageDown', 'End'].forEach((keyCode) => it(
      `selects-last-enabled-option-when-${keyCode}-pressed`,
      async function() {
        assert.equal(this.el.value, options[0].value);

        this.el.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;

        assert.equal(this.el.value, options[2].value);

        // Let's disable the last item, then the second last item should be
        // selected.
        const newOptions = createOptions();
        newOptions[2].disabled = true;
        this.el.options = newOptions;
        await this.el.updateComplete;

        this.el.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;

        assert.equal(this.el.value, newOptions[1].value);
      },
  ));

  ['ArrowLeft', 'ArrowUp'].forEach((keyCode) => it(
      `selects-previous-enabled-option-when-${keyCode}-pressed`,
      async function() {
        await window.preferenceManager.set(preference, options[2].value);
        assert.equal(this.el.value, options[2].value);

        this.el.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;
        assert.equal(this.el.value, options[1].value);

        this.el.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;
        assert.equal(this.el.value, options[0].value);

        this.el.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;
        // There is not previous option.
        assert.equal(this.el.value, options[0].value);

        // Let's disable the second option, and it should be skipped.
        const newOptions = createOptions();
        newOptions[1].disabled = true;
        this.el.options = newOptions;
        await this.el.updateComplete;

        await window.preferenceManager.set(preference, options[2].value);
        assert.equal(this.el.value, options[2].value);

        this.el.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;
        assert.equal(this.el.value, options[0].value);
      },
  ));

  ['ArrowRight', 'ArrowDown'].forEach((keyCode) => it(
      `selects-next-enabled-option-when-${keyCode}-pressed`,
      async function() {
        assert.equal(this.el.value, options[0].value);

        this.el.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;
        assert.equal(this.el.value, options[1].value);

        this.el.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;
        assert.equal(this.el.value, options[2].value);

        this.el.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;
        // There is no next option.
        assert.equal(this.el.value, options[2].value);

        // Let's disable the second option, and it should be skipped.
        const newOptions = createOptions();
        newOptions[1].disabled = true;
        this.el.options = newOptions;
        await this.el.updateComplete;

        await window.preferenceManager.set(preference, options[0].value);
        assert.equal(this.el.value, options[0].value);

        this.el.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;
        assert.equal(this.el.value, options[2].value);
      },
  ));

  it('uses-label-for-option-if-available', async function() {
    const newOptions = createOptions();
    newOptions[0].label = 'hello world';
    this.el.options = newOptions;
    await this.el.updateComplete;

    assert.equal(this.getNthLiElement(0).textContent.trim(), 'hello world');
    assert.equal(this.getNthLiElement(1).textContent.trim(),
        newOptions[1].value,
        'fallback to value if no label specified');
  });

  it('uses-style-for-option-if-available', async function() {
    const style = 'opacity: 0.5;';

    const newOptions = createOptions();
    newOptions[0].style = style;
    this.el.options = newOptions;
    await this.el.updateComplete;

    assert.equal(this.getNthLiElement(0).getAttribute('style'), style);
    assert.equal(this.getNthLiElement(1).getAttribute('style'), '');

    // Style does not apply to the "current value" <div>, only the <li>.
    assert.equal(this.el.value, newOptions[0].value);
    const currentValue = this.el.shadowRoot.querySelector('#current-value');
    assert.isNull(currentValue.getAttribute('style'));
  });

  // This only test that the attr is set. The behavior for disabled <li> element
  // (e.g. click, arrow keys) is tested in other test cases.
  it('sets-disabled-attr-for-disabled-option', async function() {
    const newOptions = createOptions();
    newOptions[0].disabled = true;
    this.el.options = newOptions;
    await this.el.updateComplete;

    assert.isTrue(this.getNthLiElement(0).hasAttribute('disabled'));
    assert.isFalse(this.getNthLiElement(1).hasAttribute('disabled'));

    // The current value <div> should also be set.
    const isCurrentValueDisabled = () => this.el.shadowRoot.querySelector(
        '#current-value').hasAttribute('data-disabled');

    await window.preferenceManager.set(preference, options[0].value);
    await this.el.updateComplete;
    assert.isTrue(isCurrentValueDisabled());

    await window.preferenceManager.set(preference, options[1].value);
    await this.el.updateComplete;
    assert.isFalse(isCurrentValueDisabled());
  });

  it('allows-type-coercion-for-value-matching', async function() {
    window.preferenceManager.definePreference(preference, 1);
    this.el.options = [
      {value: 1},
      {value: 2},
      {value: 3},
    ];
    await this.el.updateComplete;

    assert.strictEqual(window.preferenceManager.get(preference), 1);
    assert.strictEqual(this.el.value, 1);

    // Update prefs with a string, and make sure the current value is updated.
    await window.preferenceManager.set(preference, '2');
    assert.strictEqual(this.el.value, '2');  // This is still a string.
    assert.strictEqual(
        this.el.shadowRoot.querySelector('#current-value').innerText, '2');
  });
});
