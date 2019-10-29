// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Hue Slider unit tests
 */

import {HueSliderElement as Element} from './hue_slider.js';

describe('hue_slider_tests.js', () => {
  const createElement = (hue) => {
    const el = document.createElement(Element.is);
    el.setAttribute('hue', hue);
    return el;
  };

  const getPicker = el => el.shadowRoot.getElementById('picker');

  before(function() {
    if (customElements.get(Element.is) === undefined) {
      customElements.define(
          Element.is,
          Element);
    }
  });

  afterEach(function() {
    document.querySelectorAll(Element.is)
        .forEach(el => el.parentElement.removeChild(el));
  });

  it('initialises-the-picker-to-the-correct-x-coordinates', async function() {
    const els = [createElement(0), createElement(180), createElement(360)];

    els.forEach(el => document.body.appendChild(el));
    await Promise.all(els.map(el => el.updateComplete));

    assert.deepEqual(
        els.map(el => getPicker(el).style.left), ['0%', '50%', '100%']);
  });

  it('updates-picker-location-when-attribute-changed', async function() {
    const el = createElement(90);

    document.body.appendChild(el);
    await el.updateComplete;

    assert.equal(getPicker(el).style.left, '25%');

    el.setAttribute('hue', 270);
    await el.updateComplete;

    assert.equal(getPicker(el).style.left, '75%');
  });

  it('updates-picker-location-when-clicked', async function() {
    const el = createElement(90);

    document.body.appendChild(el);
    await el.updateComplete;

    assert.equal(getPicker(el).style.left, '25%');

    // Manually call handler, as you can't set offsetX on a custom mouse event.
    el.onClick_({offsetX: el.clientWidth * 0.75});
    await el.updateComplete;

    assert.equal(getPicker(el).style.left, '75%');
    assert.equal(el.getAttribute('hue'), 270);
  });

  it('publishes-event-when-clicked', async function() {
    const el = createElement(90);

    document.body.appendChild(el);
    await el.updateComplete;

    let listenerInvocations = 0;
    el.addEventListener('updated', () => ++listenerInvocations);
    el.dispatchEvent(new MouseEvent('click'));
    await el.updateComplete;

    assert.equal(listenerInvocations, 1);
  });
});
