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

  const getDimensions = (element) => {
    return {
      l: element.offsetLeft,
      w: element.offsetWidth,
      t: element.offsetTop,
      h: element.offsetHeight,
    };
  };

  before(function() {
    if (customElements.get(Element.is) === undefined) {
      customElements.define(Element.is, Element);
    }
  });

  afterEach(function() {
    document.querySelectorAll(Element.is)
        .forEach((el) => el.parentNode.removeChild(el));
  });

  it('dispatches-terminal-window-ready-when-connected', function() {
    const el = document.createElement(Element.is);
    let slot = null;
    el.addEventListener(
        'terminal-window-ready', (event) => slot = event.detail.slot);

    document.body.appendChild(el);
    assert(slot);

    const contents = document.createElement('div');
    contents.id = 'contents';
    contents.slot = slot;

    el.appendChild(contents);
    assert(document.getElementById('contents'));
  });

  it('does-not-show-controls-when-not-enabled', function() {
    const el = document.createElement(Element.is);
    let eventTriggerCount = 0;
    el.addEventListener(
        'terminal-window-ready', (event) => ++eventTriggerCount);

    document.body.appendChild(el);
    assert.lengthOf(el.shadowRoot.querySelectorAll('.window'), 1);
    assert.equal(eventTriggerCount, 1);
    {
      const displayValues =
          getStyles(el.shadowRoot.querySelectorAll('.controls'), 'display');
      assert.lengthOf(displayValues, 4);
      assert.lengthOf(displayValues.filter((x) => x != 'none'), 0);
    }

    el.shadowRoot.querySelectorAll('.controls')
        .forEach((control) => control.click());
    assert.lengthOf(el.shadowRoot.querySelectorAll('.window'), 1);
    assert.equal(eventTriggerCount, 1);
    {
      const displayValues =
          getStyles(el.shadowRoot.querySelectorAll('.controls'), 'display');
      assert.lengthOf(displayValues, 4);
      assert.lengthOf(displayValues.filter((x) => x != 'none'), 0);
    }
  });

  it('shows-controls-and-adds-new-slots-when-enabled-and-controls-clicked',
      function() {
    const el = document.createElement(Element.is);
    let eventTriggerCount = 0;
    el.addEventListener(
        'terminal-window-ready', (event) => ++eventTriggerCount);
    el.setAttribute('terminal-splits-enabled', true);

    document.body.appendChild(el);
    assert.lengthOf(el.shadowRoot.querySelectorAll('.window'), 1);
    assert.equal(eventTriggerCount, 1);
    {
      const displayValues =
          getStyles(el.shadowRoot.querySelectorAll('.controls'), 'display');
      assert.lengthOf(displayValues, 4);
      assert.lengthOf(displayValues.filter((x) => x != 'none'), 4);
    }

    el.shadowRoot.querySelectorAll('.controls')
        .forEach((control) => control.click());
    assert.lengthOf(el.shadowRoot.querySelectorAll('.window'), 5);
    assert.equal(eventTriggerCount, 5);
    {
      const displayValues =
          getStyles(el.shadowRoot.querySelectorAll('.controls'), 'display');
      assert.lengthOf(displayValues, 20);
      assert.lengthOf(displayValues.filter((x) => x != 'none'), 20);
    }
  });

  it('can-split-vertically-towards-the-left', function() {
    const el = document.createElement(Element.is);
    const slots = [];
    el.addEventListener(
        'terminal-window-ready', (event) => slots.push(event.detail.slot));
    el.setAttribute('terminal-splits-enabled', true);
    el.style.width = '500px';
    el.style.height = '500px';

    document.body.appendChild(el);
    assert.lengthOf(slots, 1);
    {
      const first =
          el.shadowRoot.querySelector(`slot[name="${slots[0]}"]`).parentNode;
      assert.deepEqual(getDimensions(el), getDimensions(first));
    }

    el.shadowRoot.querySelector('.controls[side="L"]').click();
    assert.lengthOf(slots, 2);
    {
      const first =
          el.shadowRoot.querySelector(`slot[name="${slots[0]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual({l: l + w / 2, w: w / 2, t, h}, getDimensions(first));
    }

    {
      const second =
          el.shadowRoot.querySelector(`slot[name="${slots[1]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual({l, w: w / 2, t, h}, getDimensions(second));
    }
  });

  it('can-split-vertically-towards-the-right', function() {
    const el = document.createElement(Element.is);
    const slots = [];
    el.addEventListener(
        'terminal-window-ready', (event) => slots.push(event.detail.slot));
    el.setAttribute('terminal-splits-enabled', true);
    el.style.width = '500px';
    el.style.height = '500px';

    document.body.appendChild(el);
    assert.lengthOf(slots, 1);
    {
      const first =
          el.shadowRoot.querySelector(`slot[name="${slots[0]}"]`).parentNode;
      assert.deepEqual(getDimensions(el), getDimensions(first));
    }

    el.shadowRoot.querySelector('.controls[side="R"]').click();
    assert.lengthOf(slots, 2);
    {
      const first =
          el.shadowRoot.querySelector(`slot[name="${slots[0]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual({l, w: w / 2, t, h}, getDimensions(first));
    }

    {
      const second =
          el.shadowRoot.querySelector(`slot[name="${slots[1]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual({l: l + w / 2, w: w / 2, t, h}, getDimensions(second));
    }
  });

  it('can-split-horizontally-towards-the-bottom', function() {
    const el = document.createElement(Element.is);
    const slots = [];
    el.addEventListener(
        'terminal-window-ready', (event) => slots.push(event.detail.slot));
    el.setAttribute('terminal-splits-enabled', true);
    el.style.width = '500px';
    el.style.height = '500px';

    document.body.appendChild(el);
    assert.lengthOf(slots, 1);
    {
      const first =
          el.shadowRoot.querySelector(`slot[name="${slots[0]}"]`).parentNode;
      assert.deepEqual(getDimensions(el), getDimensions(first));
    }

    el.shadowRoot.querySelector('.controls[side="B"]').click();
    assert.lengthOf(slots, 2);
    {
      const first =
          el.shadowRoot.querySelector(`slot[name="${slots[0]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual({l, w, t, h: h / 2}, getDimensions(first));
    }

    {
      const second =
          el.shadowRoot.querySelector(`slot[name="${slots[1]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual({l, w, t: t + h / 2, h: h / 2}, getDimensions(second));
    }
  });

  it('can-split-horizontally-towards-the-top', function() {
    const el = document.createElement(Element.is);
    const slots = [];
    el.addEventListener(
        'terminal-window-ready', (event) => slots.push(event.detail.slot));
    el.setAttribute('terminal-splits-enabled', true);
    el.style.width = '500px';
    el.style.height = '500px';

    document.body.appendChild(el);
    assert.lengthOf(slots, 1);
    {
      const first =
          el.shadowRoot.querySelector(`slot[name="${slots[0]}"]`).parentNode;
      assert.deepEqual(getDimensions(el), getDimensions(first));
    }

    el.shadowRoot.querySelector('.controls[side="T"]').click();
    assert.lengthOf(slots, 2);
    {
      const first =
          el.shadowRoot.querySelector(`slot[name="${slots[0]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual({l, w, t: t + h / 2, h: h / 2}, getDimensions(first));
    }

    {
      const second =
          el.shadowRoot.querySelector(`slot[name="${slots[1]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual({l, w, t, h: h / 2}, getDimensions(second));
    }
  });

  it('cannot-destroy-root-slot', function() {
    const el = document.createElement(Element.is);
    const slots = [];
    el.addEventListener(
        'terminal-window-ready', (event) => slots.push(event.detail.slot));

    document.body.appendChild(el);
    assert.lengthOf(el.shadowRoot.querySelectorAll('slot'), 1);

    el.destroySlot(slots[0]);
    assert.lengthOf(el.shadowRoot.querySelectorAll('slot'), 1);
  });

  for (const [name, edge] of
           [['left', 'L'], ['right', 'R'], ['top', 'T'], ['bottom', 'B']]) {
    it(`can-destroy-${name}-split-slot`, function() {
      const el = document.createElement(Element.is);
      const slots = [];
      el.addEventListener(
          'terminal-window-ready', (event) => slots.push(event.detail.slot));
      el.setAttribute('terminal-splits-enabled', true);
      el.style.width = '500px';
      el.style.height = '500px';

      document.body.appendChild(el);
      assert.lengthOf(el.shadowRoot.querySelectorAll('slot'), 1);

      el.shadowRoot.querySelector(`.controls[side="${edge}"]`).click();
      assert.lengthOf(el.shadowRoot.querySelectorAll('slot'), 2);

      el.destroySlot(slots[0]);
      assert.lengthOf(el.shadowRoot.querySelectorAll('slot'), 1);
      assert.equal(
          el.shadowRoot.querySelector('slot').getAttribute('name'), slots[1]);
      const slot = el.shadowRoot.querySelector('slot').parentNode;
      assert.deepEqual(getDimensions(el), getDimensions(slot));
    });
  }

  it('can-destroy-deep-split-slot', function() {
    const el = document.createElement(Element.is);
    const slots = [];
    el.addEventListener(
        'terminal-window-ready', (event) => slots.push(event.detail.slot));
    el.setAttribute('terminal-splits-enabled', true);
    el.style.width = '500px';
    el.style.height = '500px';

    document.body.appendChild(el);
    assert.lengthOf(el.shadowRoot.querySelectorAll('slot'), 1);

    el.shadowRoot.querySelector(`slot[name=${slots[0]}]`)
        .parentNode.querySelector('.controls[side="R"]')
        .click();
    assert.lengthOf(el.shadowRoot.querySelectorAll('slot'), 2);
    {
      const first =
          el.shadowRoot.querySelector(`slot[name="${slots[0]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual({l, w: w / 2, t, h}, getDimensions(first));
    }

    {
      const second =
          el.shadowRoot.querySelector(`slot[name="${slots[1]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual({l: l + w / 2, w: w / 2, t, h}, getDimensions(second));
    }

    el.shadowRoot.querySelector(`slot[name=${slots[1]}]`)
        .parentNode.querySelector('.controls[side="L"]')
        .click();
    assert.lengthOf(el.shadowRoot.querySelectorAll('slot'), 3);
    {
      const first =
          el.shadowRoot.querySelector(`slot[name="${slots[0]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual({l, w: w / 2, t, h}, getDimensions(first));
    }

    {
      const second =
          el.shadowRoot.querySelector(`slot[name="${slots[1]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual(
          {l: l + 3 * w / 4, w: w / 4, t, h}, getDimensions(second));
    }

    {
      const third =
          el.shadowRoot.querySelector(`slot[name="${slots[2]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual(
          {l: l + 2 * w / 4, w: w / 4, t, h}, getDimensions(third));
    }

    el.destroySlot(slots[2]);
    assert.lengthOf(el.shadowRoot.querySelectorAll('slot'), 2);
    {
      const first =
          el.shadowRoot.querySelector(`slot[name="${slots[0]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual({l, w: w / 2, t, h}, getDimensions(first));
    }

    {
      const second =
          el.shadowRoot.querySelector(`slot[name="${slots[1]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual({l: l + w / 2, w: w / 2, t, h}, getDimensions(second));
    }
  });

  it('can-destroy-slot-whose-sibling-is-not-a-leaf', function() {
    const el = document.createElement(Element.is);
    const slots = [];
    el.addEventListener(
        'terminal-window-ready', (event) => slots.push(event.detail.slot));
    el.setAttribute('terminal-splits-enabled', true);
    el.style.width = '500px';
    el.style.height = '500px';

    document.body.appendChild(el);
    assert.lengthOf(el.shadowRoot.querySelectorAll('slot'), 1);

    el.shadowRoot.querySelector(`slot[name=${slots[0]}]`)
        .parentNode.querySelector('.controls[side="R"]')
        .click();
    assert.lengthOf(el.shadowRoot.querySelectorAll('slot'), 2);
    {
      const first =
          el.shadowRoot.querySelector(`slot[name="${slots[0]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual({l, w: w / 2, t, h}, getDimensions(first));
    }

    {
      const second =
          el.shadowRoot.querySelector(`slot[name="${slots[1]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual({l: l + w / 2, w: w / 2, t, h}, getDimensions(second));
    }

    el.shadowRoot.querySelector(`slot[name=${slots[1]}]`)
        .parentNode.querySelector('.controls[side="L"]')
        .click();
    assert.lengthOf(el.shadowRoot.querySelectorAll('slot'), 3);
    {
      const first =
          el.shadowRoot.querySelector(`slot[name="${slots[0]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual({l, w: w / 2, t, h}, getDimensions(first));
    }

    {
      const second =
          el.shadowRoot.querySelector(`slot[name="${slots[1]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual(
          {l: l + 3 * w / 4, w: w / 4, t, h}, getDimensions(second));
    }

    {
      const third =
          el.shadowRoot.querySelector(`slot[name="${slots[2]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual(
          {l: l + 2 * w / 4, w: w / 4, t, h}, getDimensions(third));
    }

    el.shadowRoot.querySelector(`slot[name=${slots[1]}]`)
        .parentNode.querySelector('.controls[side="R"]')
        .click();
    assert.lengthOf(el.shadowRoot.querySelectorAll('slot'), 4);
    {
      const first =
          el.shadowRoot.querySelector(`slot[name="${slots[0]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual({l, w: w / 2, t, h}, getDimensions(first));
    }

    {
      const second =
          el.shadowRoot.querySelector(`slot[name="${slots[1]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual(
          {l: l + 3 * w / 4, w: Math.ceil(w / 8), t, h}, getDimensions(second));
    }

    {
      const third =
          el.shadowRoot.querySelector(`slot[name="${slots[2]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual(
          {l: l + 2 * w / 4, w: w / 4, t, h}, getDimensions(third));
    }

    {
      const fourth =
          el.shadowRoot.querySelector(`slot[name="${slots[3]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual(
          {l: Math.ceil(l + 7 * w / 8), w: Math.floor(w / 8), t, h},
          getDimensions(fourth));
    }

    el.destroySlot(slots[2]);
    assert.lengthOf(el.shadowRoot.querySelectorAll('slot'), 3);
    {
      const first =
          el.shadowRoot.querySelector(`slot[name="${slots[0]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual({l, w: w / 2, t, h}, getDimensions(first));
    }

    {
      const second =
          el.shadowRoot.querySelector(`slot[name="${slots[1]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual(
          {l: l + w / 2, w: Math.ceil(3 * w / 8), t, h}, getDimensions(second));
    }

    {
      const fourth =
          el.shadowRoot.querySelector(`slot[name="${slots[3]}"]`).parentNode;
      const {l, w, t, h} = getDimensions(el);
      assert.deepEqual(
          {l: Math.ceil(l + 7 * w / 8), w: Math.floor(w / 8), t, h},
          getDimensions(fourth));
    }
  });
});
