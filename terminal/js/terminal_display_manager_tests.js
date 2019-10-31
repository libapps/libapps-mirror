// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Display Manager Element unit tests.
 */

import {TerminalDisplayManagerElement as Element} from
    './terminal_display_manager.js';

describe('terminal_display_manager_tests.js', () => {
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
});
