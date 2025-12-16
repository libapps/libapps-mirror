// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Sauration Value Picker unit tests
 */

import {SaturationValuePickerElement, ARROW_KEY_OFFSET} from
    './terminal_settings_saturation_value_picker.js';

describe('saturation_value_picker.js', () => {
  const ERROR = 1;
  /**
   * @param {number} saturation
   * @param {number} value
   * @return {!Element}
   */
  const createElement = (saturation, value) => {
    const el = document.createElement(SaturationValuePickerElement.is);
    el.setAttribute('saturation', saturation);
    el.setAttribute('value', value);
    return el;
  };

  /**
   * @param {!Element} el
   * @return {!Element}
   */
  const getPicker = (el) => el.shadowRoot.getElementById('picker');

  /**
   * @param {!Element} el
   * @param {number} saturation
   * @param {number} value
   */
  const assertPickerPositionCloseTo = (el, saturation, value) => {
    assert.closeTo(parseFloat(getPicker(el).style.left), saturation, ERROR);
    assert.closeTo(100 - parseFloat(getPicker(el).style.top), value, ERROR);
  };

  afterEach(function() {
    document.querySelectorAll(SaturationValuePickerElement.is).forEach(
        (el) => el.remove());
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

    els.forEach((el) => document.body.appendChild(el));
    await Promise.all(els.map((el) => el.updateComplete));

    assert.deepEqual(
        els.map(getPicker).map((el) => [el.style.left, el.style.top]), [
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

  it('updates-on-pointer-event', async function() {
    const saturation = 25;
    const value = 75;
    const newSaturation = 40;
    const newValue = 10;
    const el = createElement(saturation, value);

    document.body.appendChild(el);
    await el.updateComplete;
    assertPickerPositionCloseTo(el, saturation, value);

    let listenerInvocations = 0;
    el.addEventListener('change', () => {
      assert.closeTo(el.saturation, newSaturation, ERROR);
      assert.closeTo(el.value, newValue, ERROR);
      ++listenerInvocations;
    });
    // Manually call handler, as you can't set offsetX/offsetY on a custom
    // pointer event, and the event handlers may throw an error for a fake
    // pointerId.
    el.onPointerEvent_(/** @type {!Event} */ ({
      offsetX: el.clientWidth * newSaturation / 100,
      offsetY: el.clientHeight * (100 - newValue) / 100,
    }));
    await el.updateComplete;
    assertPickerPositionCloseTo(el, newSaturation, newValue);
    assert.equal(listenerInvocations, 1);
  });

  [
      ['ArrowLeft', -ARROW_KEY_OFFSET, 0],
      ['ArrowRight', ARROW_KEY_OFFSET, 0],
      ['ArrowUp', 0, ARROW_KEY_OFFSET],
      ['ArrowDown', 0, -ARROW_KEY_OFFSET],
  ].forEach(([key, saturationOffset, valueOffset]) => it(
      `updates-on-${key}`, async function() {
        const saturation = 25;
        const value = 75;
        const newSaturation = saturation + saturationOffset;
        const newValue = value + valueOffset;
        const el = createElement(saturation, value);

        document.body.appendChild(el);
        await el.updateComplete;
        assertPickerPositionCloseTo(el, saturation, value);

        let listenerInvocations = 0;
        el.addEventListener('change', () => {
          assert.closeTo(el.saturation, newSaturation, ERROR);
          assert.closeTo(el.value, newValue, ERROR);
          ++listenerInvocations;
        });
        getPicker(el).dispatchEvent(new KeyboardEvent('keydown', {code: key}));
        await el.updateComplete;
        assertPickerPositionCloseTo(el, newSaturation, newValue);
        assert.equal(listenerInvocations, 1);
      }));

});
