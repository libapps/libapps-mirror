// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Category Selector Element unit tests.
 */

import {TerminalSettingsCategorySelectorElement} from
  './terminal_settings_category_selector.js';

describe('terminal_settings_category_selector_tests.js', () => {
  const categories = [
    {id: 'cat1', titleId: 'title1'},
    {id: 'cat2', titleId: 'title2'},
    {id: 'cat3', titleId: 'title3'},
  ];

  /**
   * @param {!Array|!NodeList} collection
   *
   * @suppress {missingProperties}
   */
  const assertIsEmpty = (collection) => {
    assert.isEmpty(collection);
  };

  /**
   * @param {string} query
   * @param {?Element} element
   *
   * @suppress {missingProperties}
   */
  const assertQueriedElementIs = (query, element) => {
    const elements = [...document.querySelectorAll(query)];
    assert.lengthOf(elements, 1);
    assert.equal(elements[0], element);
  };

  before(function() {
    if (customElements.get(TerminalSettingsCategorySelectorElement.is) ===
        undefined) {
      customElements.define(
          TerminalSettingsCategorySelectorElement.is,
          TerminalSettingsCategorySelectorElement);
    }
  });

  beforeEach(function() {
    this.selectorEl = document.createElement(
        'terminal-settings-category-selector');
    this.selectorEl.innerHTML = categories.map(category => `
        <terminal-settings-category-option for='${category.id}'>
          <h1 slot='title' id='${category.titleId}'>A Title</h1>
        </terminal-settings-category-option>
    `).join('');
    this.categoriesEl = document.createElement('div');
    this.categoriesEl.innerHTML = categories.map(category => `
        <div id='${category.id}'></div>
    `).join('');
  });

  afterEach(function() {
    for (const el of [this.selectorEl, this.categoriesEl]) {
      if (el.parentElement) {
        el.parentElement.removeChild(el);
      }
    }
  });

  it('sets-first-elements-active-attibute-on-construction', function() {
    document.body.appendChild(this.categoriesEl);
    assertIsEmpty(document.querySelectorAll('[active-category]'));
    assertIsEmpty(document.querySelectorAll('[active]'));

    document.body.appendChild(this.selectorEl);
    assertQueriedElementIs('[active-category]',
        document.getElementById(categories[0].id));
    assertQueriedElementIs('[active]',
        document.getElementById(categories[0].titleId).parentElement);
  });

  it('updates-elements-active-attribute-on-click', function() {
    document.body.appendChild(this.categoriesEl);
    document.body.appendChild(this.selectorEl);
    assertQueriedElementIs('[active-category]',
        document.getElementById(categories[0].id));
    assertQueriedElementIs('[active]',
        document.getElementById(categories[0].titleId).parentElement);

    document.getElementById(categories[1].titleId).click();
    assertQueriedElementIs('[active-category]',
        document.getElementById(categories[1].id));
    assertQueriedElementIs('[active]',
        document.getElementById(categories[1].titleId).parentElement);

    document.getElementById(categories[2].titleId).click();
    assertQueriedElementIs('[active-category]',
        document.getElementById(categories[2].id));
    assertQueriedElementIs('[active]',
        document.getElementById(categories[2].titleId).parentElement);
  });
});
