// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Category Selector Polymer Element unit tests.
 */

import {TerminalSettingsCategorySelectorElement} from
  './terminal_settings_category_selector.js';

describe('terminal_settings_category_selector_tests.js', () => {
  const categories = [
    {id: 'cat1', titleId: 'title1'},
    {id: 'cat2', titleId: 'title2'},
    {id: 'cat3', titleId: 'title3'},
  ];
  const selectorEl = document.createElement(
      'terminal-settings-category-selector');
  selectorEl.innerHTML = `
    <terminal-settings-category-option for='${categories[0].id}'>
      <h1 slot='title' id='${categories[0].titleId}'>A Title</h1>
    </terminal-settings-category-option>
    <terminal-settings-category-option for='${categories[1].id}'>
      <h1 slot='title' id='${categories[1].titleId}'>A Title</h1>
    </terminal-settings-category-option>
    <terminal-settings-category-option for='${categories[2].id}'>
      <h1 slot='title' id='${categories[2].titleId}'>A Title</h1>
    </terminal-settings-category-option>
  `;
  const categoriesEl = document.createElement('div');
  categoriesEl.innerHTML = `
    <div id='${categories[0].id}'></div>
    <div id='${categories[1].id}'></div>
    <div id='${categories[2].id}'></div>
  `;

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

  afterEach(function() {
    document.body.removeChild(selectorEl);
    document.body.removeChild(categoriesEl);
  });

  it('category-selector-sets-first-elements-active-attribute-on-construction',
      function() {
    document.body.appendChild(categoriesEl);
    assertIsEmpty(document.querySelectorAll('[active-category]'));
    assertIsEmpty(document.querySelectorAll('[active]'));

    document.body.appendChild(selectorEl);
    assertQueriedElementIs('[active-category]',
        document.getElementById(categories[0].id));
    assertQueriedElementIs('[active]',
        document.getElementById(categories[0].titleId).parentElement);
  });

  it('category-selector-updates-elements-active-attribute-on-click',
      function() {
    document.body.appendChild(categoriesEl);
    document.body.appendChild(selectorEl);
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
