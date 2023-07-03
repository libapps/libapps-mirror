// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal find bar unit tests.
 */

import {sleep} from './terminal_common.js';
import './terminal_find_bar.js';
import {MockFunction} from './terminal_test_mocks.js';

describe('terminal_find_bar_tests.js', function() {
  beforeEach(async function() {
    this.findBar = document.createElement('terminal-find-bar');
    document.body.appendChild(this.findBar);
    await this.findBar.updateComplete;
    this.findBar.show();
    this.input = this.findBar.inputRef_.value;
    this.previousButton = this.findBar.shadowRoot.querySelector(
        'div[aria-label="HTERM_BUTTON_PREVIOUS"]');
    this.nextButton = this.findBar.shadowRoot.querySelector(
        'div[aria-label="HTERM_BUTTON_NEXT"]');
    this.closeButton = this.findBar.shadowRoot.querySelector(
        'div[aria-label="HTERM_BUTTON_CLOSE_FIND_BAR"]');

    this.eventDetails = [];
    this.findBar.addEventListener(
        'find-bar', (e) => this.eventDetails.push(e.detail));

    this.setInputValue = function(value) {
      this.input.value = value;
      this.input.dispatchEvent(new Event('input'), {
        bubbles: true,
      });
    };

    this.keyDownOnInput = function(options) {
      this.input.dispatchEvent(new KeyboardEvent('keydown', options));
    };
  });

  afterEach(function() {
    document.body.removeChild(this.findBar);
  });

  /**
   * @param {!Element} button
   * @return {boolean}
   */
  function buttonIsEnabled(button) {
    switch (button['ariaDisabled']) {
      case 'true':
        return false;
      case null:
        return true;
      default:
        throw new Error(
            `button ariaDisabled (${button['ariaDisabled']}) is invalid`);
    }
  }

  it('enables-up-down-button-iff-input-has-content', async function() {
    assert.isFalse(buttonIsEnabled(this.previousButton));
    assert.isFalse(buttonIsEnabled(this.nextButton));

    this.setInputValue('x');
    await this.findBar.updateComplete;
    assert.isTrue(buttonIsEnabled(this.previousButton));
    assert.isTrue(buttonIsEnabled(this.nextButton));

    this.setInputValue('');
    await this.findBar.updateComplete;
    assert.isFalse(buttonIsEnabled(this.previousButton));
    assert.isFalse(buttonIsEnabled(this.nextButton));
  });

  // Parameterized tests for actions that trigger "find" events.
  [{
    action: function() { this.nextButton.click(); },
    backward: false,
  }, {
    action: function() { this.previousButton.click(); },
    backward: true,
  }, {
    action: function() {
      this.keyDownOnInput({key: 'Enter', shiftKey: false});
    },
    backward: false,
  }, {
    action: function() {
      this.keyDownOnInput({key: 'Enter', shiftKey: true});
    },
    backward: true,
  }].forEach(({action, backward}, i) => (
      it(`fire-find-event-${i}`, async function() {
        assert.lengthOf(this.eventDetails, 0);
        action.call(this);
        await sleep(0);
        assert.deepEqual(this.eventDetails, [{
          type: 'find',
          backward,
        }]);
  })));

  // Parameterized tests for actions that trigger "close" events.
  [
    function() { this.closeButton.click(); },
    function() { this.keyDownOnInput({key: 'Escape'}); },
  ].forEach((action, i) => it(`close-${i}`, async function() {
    assert.notEqual(this.findBar.style.display, 'none');
    assert.lengthOf(this.eventDetails, 0);
    action.call(this);
    await sleep(0);
    assert.equal(this.findBar.style.display, 'none');
    assert.deepEqual(this.eventDetails, [{type: 'close'}]);
  }));

  it('fire-find-on-input', async function() {
    const scheduleFindNextEventMock = new MockFunction();
    this.findBar.scheduleFindNextEvent_ = scheduleFindNextEventMock.proxy;
    this.setInputValue('hello');
    await sleep(0);
    assert.deepEqual(scheduleFindNextEventMock.getHistory(), [[]]);
  });
});
