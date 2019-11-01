// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Display Manager Element unit tests.
 */

import {TerminalDisplayManagerElement as Element} from
    './terminal_display_manager.js';

describe('terminal_display_manager_tests.js', () => {
  /**
   * @param {!Element} element
   * @param {string} key
   * @return {string}
   */
  const getStyle = (element, key) => {
    return window.getComputedStyle(element).getPropertyValue(key);
  };

  /**
   * @param {!Array<!Element>} elements
   * @param {string} key
   * @return {!Array<string>}
   */
  const getStyles = (elements, key) => {
    return Array.prototype.map.call(elements, (el) => getStyle(el, key));
  };

  before(function() {
    if (customElements.get(Element.is) === undefined) {
      customElements.define(Element.is, Element);
    }
  });

  afterEach(function() {
    document.querySelectorAll(Element.is)
        .forEach(el => el.parentNode.removeChild(el));
  });

  it('dispatches-terminal-display-ready-when-connected', function() {
    const el = document.createElement(Element.is);
    let slot = null;
    el.addEventListener(
        'terminal-display-ready', (event) => slot = event.detail.slot);

    document.body.appendChild(el);
    assert(slot);

    const contents = document.createElement('div');
    contents.id = 'contents';
    contents.slot = slot;

    el.appendChild(contents);
    assert(document.getElementById('contents'));
  });

  it('does-not-show-controls-when-not-enabled', function () {
    const el = document.createElement(Element.is);
    let eventTriggerCount = 0;
    el.addEventListener(
        'terminal-display-ready', (event) => ++eventTriggerCount);

    document.body.appendChild(el);
    assert.lengthOf(el.shadowRoot.querySelectorAll('.display'), 1);
    assert.equal(eventTriggerCount, 1);
    {
      const displayValues =
          getStyles(el.shadowRoot.querySelectorAll('.controls'), 'display');
      assert.lengthOf(displayValues, 4);
      assert.lengthOf(displayValues.filter(x => x != 'none'), 0);
    }

    el.shadowRoot.querySelectorAll('.controls')
        .forEach(control => control.click());
    assert.lengthOf(el.shadowRoot.querySelectorAll('.display'), 1);
    assert.equal(eventTriggerCount, 1);
    {
      const displayValues =
          getStyles(el.shadowRoot.querySelectorAll('.controls'), 'display');
      assert.lengthOf(displayValues, 4);
      assert.lengthOf(displayValues.filter(x => x != 'none'), 0);
    }
  });

  it('shows-controls-and-adds-new-slots-when-enabled-and-controls-clicked',
      function () {
    const el = document.createElement(Element.is);
    let eventTriggerCount = 0;
    el.addEventListener(
        'terminal-display-ready', (event) => ++eventTriggerCount);
    el.setAttribute('terminal-splits-enabled', true);

    document.body.appendChild(el);
    assert.lengthOf(el.shadowRoot.querySelectorAll('.display'), 1);
    assert.equal(eventTriggerCount, 1);
    {
      const displayValues =
          getStyles(el.shadowRoot.querySelectorAll('.controls'), 'display');
      assert.lengthOf(displayValues, 4);
      assert.lengthOf(displayValues.filter(x => x != 'none'), 4);
    }

    el.shadowRoot.querySelectorAll('.controls')
        .forEach(control => control.click());
    assert.lengthOf(el.shadowRoot.querySelectorAll('.display'), 5);
    assert.equal(eventTriggerCount, 5);
    {
      const displayValues =
          getStyles(el.shadowRoot.querySelectorAll('.controls'), 'display');
      assert.lengthOf(displayValues, 20);
      assert.lengthOf(displayValues.filter(x => x != 'none'), 20);
    }
  });
});
