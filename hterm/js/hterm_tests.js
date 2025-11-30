// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview hterm unit tests.  Specifically for core/high-level functions.
 * @suppress {deprecated} execCommand
 */

import {hterm} from '../index.js';
import {MockNotification} from './hterm_mock_notification.js';

describe('hterm_tests.js', () => {

/**
 * Mock out notifications.
 *
 * Called before each test case in this suite.
 */
beforeEach(() => {
  MockNotification.start();
});

/**
 * Restore any mocked out objects.
 *
 * Called after each test case in this suite.
 */
afterEach(() => {
  MockNotification.stop();
});

/**
 * Test that basic notifications work.
 */
it('default-notification', () => {
  // Create a default notification.
  assert.equal(0, Notification.count);
  const n = hterm.notify();
  assert.equal(1, Notification.count);

  // Check the parameters.
  assert.equal(typeof n.title, 'string');
  assert.notEqual(n.title, '');
  assert.equal(n.body, '');
});

/**
 * Test that various notifications arguments work.
 */
it('notification-fields', () => {
  // Create the notification.
  assert.equal(0, Notification.count);
  const n = hterm.notify({'title': 'title', 'body': 'body'});
  assert.equal(1, Notification.count);

  // Check the parameters.
  assert.include(n.title, 'title');
  assert.equal(n.body, 'body');
});

/**
 * Test copying content via execCommand.
 */
xit('copy-execCommand', (done) => {
  const doc = globalThis.document;

  // Mock out newer clipboard API to make sure we don't use it.
  let oldClipboardWrite;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    oldClipboardWrite = navigator.clipboard.writeText;
    delete navigator.clipboard.writeText;
  }

  // Mock this out since we can't document.execCommand from the test harness.
  const oldExec = doc.execCommand;
  doc.execCommand = (cmd) => {
    doc.execCommand = oldExec;
    if (oldClipboardWrite) {
      navigator.clipboard.writeText = oldClipboardWrite;
    }

    assert.equal('copy', cmd);

    const s = doc.getSelection();
    assert.equal('copypasta!', s.toString());
    done();
  };

  // Mock the newer API too.
  delete navigator.clipboard.writeText;

  hterm.copySelectionToClipboard(doc, 'copypasta!');
});

});
