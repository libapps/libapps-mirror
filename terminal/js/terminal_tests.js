// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview chrome://terminal unit tests.
 */

describe('terminal_tests.js', () => {

/**
 * Create the #terminal div in the document for testing, and start mocks.
 */
beforeEach(function() {
  const document = window.document;
  const div = this.div = document.createElement('div');
  div.setAttribute('id', 'terminal');
  div.style.position = 'absolute';
  div.style.height = '100%';
  div.style.width = '100%';
  document.body.appendChild(div);
  this.mockTerminalPrivateController = MockTerminalPrivate.start();
});

/**
 * Remove the #terminal div from the document, and stop mocks.
 */
afterEach(function() {
  document.body.removeChild(this.div);
  this.mockTerminalPrivateController.stop();
});

/**
 *  init.
 */
it('opens-process-in-init', function(done) {
  this.mockTerminalPrivateController.addObserver(
      'openTerminalProcess', (processName, args) => {
        assert.equal('vmshell', processName);
        assert.deepEqual([], args);
        setTimeout(done, 0);
      });
  Terminal.init();
});

});
