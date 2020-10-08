// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Hue Slider unit tests
 */

import './terminal_settings_hue_slider.js';

describe('hue_slider_tests.js', () => {
  const PERCENTAGE_ERROR = 0.01;

  beforeEach(async function() {
    this.el = document.createElement('hue-slider');
    this.el.setAttribute('hue', 100);
    document.body.appendChild(this.el);
    await this.el.updateComplete;
    this.innerSlider = this.el.shadowRoot.querySelector('terminal-slider');

    this.assertInternals = function(hue) {
      assert.closeTo(hue, this.el.hue, 360 * PERCENTAGE_ERROR);
      assert.closeTo(hue / 360, this.innerSlider.value, PERCENTAGE_ERROR);
    };
  });

  afterEach(function() {
    document.body.removeChild(this.el);
  });

  it('update-slider-on-hue-changed', async function() {
    this.assertInternals(100);

    this.el.setAttribute('hue', 200);
    await this.el.updateComplete;
    this.assertInternals(200);
  });

  it('updates-hue-and-pass-through-event-on-slider-change', async function() {
    this.assertInternals(100);

    let listenerInvocations = 0;
    this.el.addEventListener('change', () => {
      this.assertInternals(200);
      ++listenerInvocations;
    });

    this.innerSlider.value = 200 / 360;
    this.innerSlider.dispatchEvent(new Event('change'));
    assert.equal(listenerInvocations, 1);
  });
});
