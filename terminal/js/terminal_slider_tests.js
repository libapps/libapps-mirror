// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Slider unit tests
 */

import {ARROW_KEY_OFFSET} from './terminal_slider.js';

describe('terminal_slider.js', () => {
  const ERROR = 0.001;

  const createElement = (value) => {
    const el = document.createElement('terminal-slider');
    el.setAttribute('value', value);
    return el;
  };

  const getKnob =
      (el) => el.shadowRoot.getElementById('knob-container');

  const assertKnobPositionCloseTo = (el, value) => {
    assert.closeTo(parseFloat(getKnob(el).style.left) / 100, value, ERROR);
  };

  afterEach(function() {
    document.querySelectorAll('terminal-slider').forEach((el) => el.remove());
  });

  it('initialises-the-knob-to-the-correct-x-coordinates', async function() {
    const values = [0, 0.5, 1];
    const els = values.map((v) => createElement(v));

    els.forEach((el) => document.body.appendChild(el));
    await Promise.all(els.map((el) => el.updateComplete));

    values.forEach((v, index) => assertKnobPositionCloseTo(els[index], v));
  });

  it('updates-knob-location-when-attribute-changed', async function() {
    const el = createElement(0.3);

    document.body.appendChild(el);
    await el.updateComplete;

    assertKnobPositionCloseTo(el, 0.3);

    el.setAttribute('value', 0.7);
    await el.updateComplete;

    assertKnobPositionCloseTo(el, 0.7);
  });

  it('updates-on-pointer-event', async function() {
    const value = 0.2;
    const newValue = 0.8;
    const el = createElement(value);

    document.body.appendChild(el);
    await el.updateComplete;
    assertKnobPositionCloseTo(el, value);

    let listenerInvocations = 0;
    el.addEventListener('change', () => {
      assert.closeTo(el.value, newValue, ERROR);
      ++listenerInvocations;
    });
    // Manually call handler, as you can't set offsetX on a custom pointer
    // event, and the event handlers may throw an error for a fake pointerId.
    el.onPointerEvent_({offsetX: el.clientWidth * newValue});
    await el.updateComplete;

    assertKnobPositionCloseTo(el, newValue);
    assert.equal(listenerInvocations, 1);
  });

  [
      ['ArrowLeft', -ARROW_KEY_OFFSET],
      ['ArrowUp', -ARROW_KEY_OFFSET],
      ['ArrowRight', ARROW_KEY_OFFSET],
      ['ArrowDown', ARROW_KEY_OFFSET],
  ].forEach(([key, amount]) => it(`updates-on-${key}`, async function() {
    const value = 0.1;
    const newValue = value + amount;
    const el = createElement(value);

    document.body.appendChild(el);
    await el.updateComplete;
    assertKnobPositionCloseTo(el, value);

    let listenerInvocations = 0;
    el.addEventListener('change', () => {
      assert.closeTo(el.value, newValue, ERROR);
      ++listenerInvocations;
    });
    getKnob(el).dispatchEvent(new KeyboardEvent('keydown', {code: key}));
    await el.updateComplete;
    assertKnobPositionCloseTo(el, newValue);
    assert.equal(listenerInvocations, 1);
  }));
});
