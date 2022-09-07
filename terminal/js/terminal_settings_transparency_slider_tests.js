// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Transparency Slider unit tests
 */

import './terminal_settings_hue_slider.js';

describe('transparency_slider_tests.js', () => {
  const PERCENTAGE_ERROR = 0.01;

  beforeEach(async function() {
    this.el = document.createElement('transparency-slider');
    this.el.setAttribute('transparency', 0.2);
    document.body.appendChild(this.el);
    await this.el.updateComplete;
    this.innerSlider = this.el.shadowRoot.querySelector('terminal-slider');

    this.assertInternals = function(transparency) {
      assert.closeTo(transparency, this.el.transparency, PERCENTAGE_ERROR);
      assert.closeTo(transparency, this.innerSlider.value, PERCENTAGE_ERROR);
    };
  });

  afterEach(function() {
    document.body.removeChild(this.el);
  });

  it('update-slider-on-transparency-changed', async function() {
    this.assertInternals(0.2);

    this.el.setAttribute('transparency', 0.5);
    await this.el.updateComplete;
    this.assertInternals(0.5);
  });

  it('updates-transparency-and-pass-through-event-on-slider-change',
      async function() {
        this.assertInternals(0.2);

        let listenerInvocations = 0;
        this.el.addEventListener('change', () => {
          this.assertInternals(0.6);
          ++listenerInvocations;
        });

        this.innerSlider.value = 0.6;
        this.innerSlider.dispatchEvent(new Event('change'));
        assert.equal(listenerInvocations, 1);
      });

  it('background-color', async function() {
    this.el.setAttribute('color', 'rgba(12, 34, 56, 78)');
    this.el.setAttribute('transparency', 0.5);
    await this.el.updateComplete;

    // #display has opaque color at the right end.
    assert.equal(
        this.el.shadowRoot.getElementById('display').getAttribute('style'),
        'background-image: linear-gradient(to right, transparent, ' +
          'rgba(12, 34, 56, 1));');

    // knob has the current transparency.
    assert.equal(
        this.el.shadowRoot.querySelector('terminal-knob').getAttribute('style'),
        'background-color: rgba(12, 34, 56, 0.5);');
  });
});
