// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview unit tests for terminal_active_tracker.js
 */

import {TerminalActiveTracker} from './terminal_active_tracker.js';

describe('TerminalActiveTracker', () => {
  const mockTabsController = new MockTabsController();

  beforeEach(() => {
    mockTabsController.start();
    window.localStorage.clear();
    TerminalActiveTracker.resetInstanceForTesting();
  });

  afterEach(() => {
    mockTabsController.stop();
  });

  function checkWindowActiveTerminal(tracker, terminalId) {
    assert.deepEqual(tracker.getWindowActiveTerminal(), {
      tabId: mockTabsController.currentTab.id,
      terminalId,
      title: document.title,
    });
  }

  it('get()', async () => {
    const tracker1 = TerminalActiveTracker.get();
    const tracker2 = TerminalActiveTracker.get();
    // They should be equal since we use singleton.
    assert.equal(await tracker1, await tracker2);
  });

  // Test that the active terminal is updated when terminalId has been set and
  // it is active.
  it('maybeUpdateWindowActiveTerminal()', async () => {
    const tracker = await TerminalActiveTracker.get();
    window.localStorage.removeItem(tracker.key);

    tracker.terminalId_ = 'terminalId-123';
    tracker.active_ = false;
    tracker.maybeUpdateWindowActiveTerminal();
    assert.isNull(tracker.getWindowActiveTerminal());

    tracker.terminalId_ = null;
    tracker.active_ = true;
    tracker.maybeUpdateWindowActiveTerminal();
    assert.isNull(tracker.getWindowActiveTerminal());

    tracker.terminalId_ = 'terminalId-123';
    tracker.active_ = true;
    tracker.maybeUpdateWindowActiveTerminal();
    checkWindowActiveTerminal(tracker, 'terminalId-123');
  });

  it('updates when set terminalId', async () => {
    const tracker = await TerminalActiveTracker.get();
    window.localStorage.removeItem(tracker.key);

    tracker.terminalId = 'terminalId-123';
    checkWindowActiveTerminal(tracker, 'terminalId-123');
  });

  it('onTabActivated_()', async () => {
    const tracker = await TerminalActiveTracker.get();
    window.localStorage.removeItem(tracker.key);

    const tabId = mockTabsController.currentTab.id;
    const windowId = mockTabsController.currentTab.windowId;

    tracker.active_ = true;
    tracker.terminalId_ = 'terminalId-123';

    // Current window focus another tab.
    tracker.onTabActivated_({tabId: tabId + 1, windowId});
    assert.isFalse(tracker.active_);
    assert.isNull(tracker.getWindowActiveTerminal());

    // Current window focus current tab.
    tracker.onTabActivated_({tabId, windowId});
    assert.isTrue(tracker.active_);
    checkWindowActiveTerminal(tracker, 'terminalId-123');

    // Another window focus some tab, which should have no effect.
    tracker.onTabActivated_({tabId: tabId + 2, windowId: windowId + 1});
    assert.isTrue(tracker.active_);
  });

  it('onUnload_() clears storage if it stores current tab', async () => {
    const tracker = await TerminalActiveTracker.get();
    const tabId = mockTabsController.currentTab.id;

    window.localStorage.setItem(tracker.key, JSON.stringify({tabId}));
    tracker.onUnload_();
    assert.isNull(tracker.getWindowActiveTerminal());

    window.localStorage.setItem(tracker.key, JSON.stringify(
        {tabId: tabId + 1}));
    tracker.onUnload_();
    assert.isNotNull(tracker.getWindowActiveTerminal());
  });
});
