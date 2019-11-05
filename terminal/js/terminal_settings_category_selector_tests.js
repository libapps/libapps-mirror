// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Category Selector Element unit tests.
 */

import {
  TerminalSettingsCategorySelectorElement,
} from './terminal_settings_category_selector.js';

describe('terminal_settings_category_selector_tests.js', () => {
  const categories = [
    {id: 'cat1', titleId: 'title1'},
    {id: 'cat2', titleId: 'title2'},
    {id: 'cat3', titleId: 'title3'},
  ];

  /**
   * @param {string} query
   * @param {?Element} element
   */
  const assertQueriedElementIs = (query, element) => {
    const elements = [...document.querySelectorAll(query)];
    assert.lengthOf(elements, 1);
    assert.equal(elements[0], element);
  };

  beforeEach(function() {
    this.categoryChanges = /** !Array<string> */ [];
    this.selectorEl = /** @type {!TerminalSettingsCategorySelectorElement} */ (
        document.createElement('terminal-settings-category-selector'));
    this.selectorEl.addEventListener('category-change',
        e => this.categoryChanges.push(e.detail.category));
    this.selectorEl.innerHTML = categories.map(category => `
        <terminal-settings-category-option for='${category.id}'>
          <h1 slot='title' id='${category.titleId}'>A Title</h1>
        </terminal-settings-category-option>
    `).join('');
  });

  afterEach(function() {
    const parentElement = this.selectorEl.parentElement;
    if (parentElement) {
      parentElement.removeChild(this.selectorEl);
    }
  });

  it('sets-first-elements-active-attibute-on-construction', function() {
    assert.isEmpty(this.categoryChanges);
    assert.isEmpty(document.querySelectorAll('[active]'));

    document.body.appendChild(this.selectorEl);
    assert.deepEqual(this.categoryChanges, [categories[0].id]);
    assertQueriedElementIs('[active]',
        document.getElementById(categories[0].titleId).parentElement);
  });

  it('updates-elements-active-attribute-on-click', function() {
    document.body.appendChild(this.selectorEl);
    assert.deepEqual(this.categoryChanges, [categories[0].id]);
    assertQueriedElementIs('[active]',
        document.getElementById(categories[0].titleId).parentElement);

    document.getElementById(categories[1].titleId).click();
    assert.deepEqual(this.categoryChanges,
        [categories[0].id, categories[1].id]);
    assertQueriedElementIs('[active]',
        document.getElementById(categories[1].titleId).parentElement);

    document.getElementById(categories[2].titleId).click();
    assert.deepEqual(this.categoryChanges,
        [categories[0].id, categories[1].id, categories[2].id]);
    assertQueriedElementIs('[active]',
        document.getElementById(categories[2].titleId).parentElement);
  });

  it('updates-elements-active-attribute-on-enter-and-space', function() {
    document.body.appendChild(this.selectorEl);
    assert.deepEqual(this.categoryChanges, [categories[0].id]);
    assertQueriedElementIs('[active]',
        document.getElementById(categories[0].titleId).parentElement);

    document.getElementById(categories[1].titleId)
        .dispatchEvent(
            new KeyboardEvent('keydown', {code: 'Space', bubbles: true}));
    assert.deepEqual(this.categoryChanges,
        [categories[0].id, categories[1].id]);
    assertQueriedElementIs('[active]',
        document.getElementById(categories[1].titleId).parentElement);

    document.getElementById(categories[2].titleId)
        .dispatchEvent(
            new KeyboardEvent('keydown', {code: 'Enter', bubbles: true}));
    assert.deepEqual(this.categoryChanges,
        [categories[0].id, categories[1].id, categories[2].id]);
    assertQueriedElementIs('[active]',
        document.getElementById(categories[2].titleId).parentElement);
  });
});
