// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal find bar unit tests.
 */

import './terminal_find_bar.js';

describe('terminal_find_bar_tests.js', () => {
  let findBar;
  let inputElement;
  let previousButton;
  let nextButton;
  let closeButton;

  beforeEach(async function() {
    findBar = document.createElement('terminal-find-bar');
    document.body.appendChild(findBar);
    await findBar.updateComplete;
    inputElement = findBar.shadowRoot.querySelector('input');
    previousButton = findBar.shadowRoot.querySelector(
        'div[aria-label="previous"]');
    nextButton = findBar.shadowRoot.querySelector('div[aria-label="next"]');
    closeButton = findBar.shadowRoot.querySelector(
        'div[aria-label="close find bar"]');
  });

  afterEach(function() {
    document.body.removeChild(findBar);
  });

  function setInputElementValue(value) {
    inputElement.value = value;
    inputElement.dispatchEvent(new Event('input'), {
      bubbles: true,
    });
  }

  function fakeEnterOnInput(shiftKey) {
    inputElement.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey,
    }));
  }

  it('enables-up-down-button-iff-input-has-content', async function() {
    assert.isFalse(previousButton.classList.contains('enabled'));
    assert.isFalse(nextButton.classList.contains('enabled'));

    setInputElementValue('x');
    await findBar.updateComplete;
    assert.isTrue(previousButton.classList.contains('enabled'));
    assert.isTrue(nextButton.classList.contains('enabled'));

    setInputElementValue('');
    await findBar.updateComplete;
    assert.isFalse(previousButton.classList.contains('enabled'));
    assert.isFalse(nextButton.classList.contains('enabled'));
  });

  function checkEvent(trigger, expectedType) {
    const eventDetails = [];
    findBar.addEventListener('find-bar-event',
        (e) => eventDetails.push(e.detail));

    trigger();
    assert.lengthOf(eventDetails, 0,
        'Events should not be fired when the input is empty');

    setInputElementValue('hello world');
    trigger();
    assert.deepEqual(eventDetails, [{
      type: expectedType,
      value: 'hello world',
    }]);
  }

  it('handles-find-next-click', async () => {
    checkEvent(() => nextButton.click(), 'find-next');
  });

  it('handles-find-previous-click', async () => {
    checkEvent(() => previousButton.click(), 'find-previous');
  });

  it('handles-enter', async () => {
    checkEvent(() => fakeEnterOnInput(false), 'find-next');
  });

  it('handles-shift-enter', async () => {
    checkEvent(() => fakeEnterOnInput(true), 'find-previous');
  });

  it('fires-close-event-on-close-button-clicked', async function() {
    const eventDetails = [];
    findBar.addEventListener(
        'find-bar-event', (e) => eventDetails.push(e.detail));
    closeButton.click();
    assert.deepEqual(eventDetails, [{type: 'close'}]);
  });
});
