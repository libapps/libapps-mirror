// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Sauration Value Picker unit tests
 */

import {SaturationValuePickerElement as Element} from
    './terminal_settings_saturation_value_picker.js';

describe('saturation_value_picker.js', () => {
  const createElement = (saturation, value) => {
    const el = document.createElement(Element.is);
    el.setAttribute('saturation', saturation);
    el.setAttribute('value', value);
    return el;
  };

  const getPicker = el => el.shadowRoot.getElementById('picker');

  afterEach(function() {
    document.querySelectorAll(Element.is)
        .forEach(el => el.parentElement.removeChild(el));
  });

  it('initialises-the-picker-to-the-correct-coordinates', async function() {
    const els = [
      createElement(0, 0),
      createElement(0, 50),
      createElement(0, 100),
      createElement(50, 0),
      createElement(50, 50),
      createElement(50, 100),
      createElement(100, 0),
      createElement(100, 50),
      createElement(100, 100),
    ];

    els.forEach(el => document.body.appendChild(el));
    await Promise.all(els.map(el => el.updateComplete));

    assert.deepEqual(
        els.map(getPicker).map(el => [el.style.left, el.style.top]), [
          ['0%', '100%'],
          ['0%', '50%'],
          ['0%', '0%'],
          ['50%', '100%'],
          ['50%', '50%'],
          ['50%', '0%'],
          ['100%', '100%'],
          ['100%', '50%'],
          ['100%', '0%'],
        ]);
  });

  it('updates-picker-location-when-attribute-changed', async function() {
    const el = createElement(25, 25);

    document.body.appendChild(el);
    await el.updateComplete;

    assert.equal(getPicker(el).style.left, '25%');
    assert.equal(getPicker(el).style.top, '75%');

    el.setAttribute('saturation', 75);
    await el.updateComplete;

    assert.equal(getPicker(el).style.left, '75%');
    assert.equal(getPicker(el).style.top, '75%');

    el.setAttribute('value', 75);
    await el.updateComplete;

    assert.equal(getPicker(el).style.left, '75%');
    assert.equal(getPicker(el).style.top, '25%');
  });

  it('updates-picker-location-on-pointer-event', async function() {
    const el = createElement(25, 25);

    document.body.appendChild(el);
    await el.updateComplete;

    assert.equal(getPicker(el).style.left, '25%');
    assert.equal(getPicker(el).style.top, '75%');

    // Manually call handler, as you can't set offsetX/offsetY on a custom
    // pointer event, and the event handlers may throw an error for a fake
    // pointerId.
    el.update_(
        {offsetX: el.clientWidth * 0.75, offsetY: el.clientHeight * 0.25});
    await el.updateComplete;

    assert.equal(getPicker(el).style.left, '75%');
    assert.equal(getPicker(el).style.top, '25%');
    assert.equal(el.getAttribute('saturation'), 75);
    assert.equal(el.getAttribute('value'), 75);
  });

  it('publishes-event-on-pointer-event', async function() {
    const el = createElement(25, 25);

    document.body.appendChild(el);
    await el.updateComplete;

    let listenerInvocations = 0;
    el.addEventListener('updated', () => ++listenerInvocations);
    // Manually call handler, as you can't set offsetX/offsetY on a custom
    // pointer event, and the event handlers may throw an error for a fake
    // pointerId.
    el.update_(
        {offsetX: el.clientWidth * 0.75, offsetY: el.clientHeight * 0.25});
    await el.updateComplete;

    assert.equal(listenerInvocations, 1);
  });
});
