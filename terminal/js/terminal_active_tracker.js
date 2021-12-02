// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @typedef {{
 *  vmName: (string|undefined),
 *  containerName: (string|undefined),
 * }}
 */
export let ContainerId;

/**
 * @typedef {{
 *            terminalId: (string|undefined),
 *            containerId: (!ContainerId|undefined),
 *            tmuxDriverChannel: (string|undefined),
 * }}
 */
let TerminalInfo;

/**
 * @typedef {{
 *            tabId: number,
 *            title: string,
 *            terminalInfo: !TerminalInfo,
 * }}
 */
let ActiveTerminalInfo;

let instancePromise_;

// This class tracks the active terminal for a window, which can have multiple
// tabs. Whenever the current tab becomes the active tab and the terminalId is
// set, this class will store an `ActiveTerminalInfo` object to localStorage
// with a key unique to the current window. Other tabs in the same window can
// use the same key to retrieve the active terminal info. Note that this class
// does not monitor the terminal's title, so `maybeUpdateWindowActiveTerminal()`
// needs to be called whenever the title changes (see `setUpTitleHandler()`).
//
// TODO(lxj): we should use sharedWorker for this once it is ready for
// chrome-untrusted://.
export class TerminalActiveTracker {
  /**
   * Gets the TerminalActiveTracker singleton. Creates the singleton if it does
   * not exist.
   *
   * @return {!Promise<!TerminalActiveTracker>}
   */
  static async get() {
    if (!instancePromise_) {
      instancePromise_ = new Promise((resolve) => {
        chrome.tabs.getCurrent(
            (tab) => resolve(new TerminalActiveTracker(lib.notNull(tab))));
      });
    }

    return instancePromise_;
  }

  static resetInstanceForTesting() {
    instancePromise_ = undefined;
  }

  /**
   * @param {!Tab} tab The current tab info.
   */
  constructor(tab) {
    /** @public {!Tab} */
    this.tab = tab;
    /** @public {?ActiveTerminalInfo} */
    this.parentTerminal = this.getWindowActiveTerminal();
    /** @public {boolean} */
    this.active_ = this.tab.active;

    /** @public {!TerminalInfo} */
    this.terminalInfo_ = {};

    chrome.tabs.onActivated.addListener((e) => this.onTabActivated_(e));
    window.addEventListener('unload', () => this.onUnload_());
  }

  /**
   * @param {!TerminalInfo} update
   */
  updateTerminalInfo(update) {
    Object.assign(this.terminalInfo_, update);
    this.maybeUpdateWindowActiveTerminal();
  }

  /**
   * Get the localStroage key for the current window.
   *
   * @return {string}
   */
  get key() {
    return TerminalActiveTracker.getKey(this.tab.windowId);
  }

  /**
   * Get the localStroage key for `windowId`.
   *
   * @param {number} windowId
   * @return {string}
   */
  static getKey(windowId) {
    // The number after the first '-' is the version number. This is to make
    // sure stale data in localStorage does not break us when we make breaking
    // changes. Note that we do clean up localStorage on unload event, but it is
    // not reliable.
    return `activeTerminalInfo-1-${windowId}`;
  }

  /**
   * Get the active terminal info for the current window.
   *
   * @return {?ActiveTerminalInfo}
   */
  getWindowActiveTerminal() {
    const data = window.localStorage.getItem(this.key);
    if (data) {
      return /** @type {!ActiveTerminalInfo} */(JSON.parse(data));
    }
    return null;
  }

  /**
   * Update the active terminal for the current window if the current tab is
   * active and the terminal id has been set.
   */
  maybeUpdateWindowActiveTerminal() {
    if (this.active_ && Object.keys(this.terminalInfo_).length) {
      window.localStorage.setItem(this.key, JSON.stringify({
        tabId: this.tab.id,
        title: document.title,
        terminalInfo: this.terminalInfo_,
      }));
    }
  }

  onTabActivated_({tabId, windowId}) {
    if (tabId === this.tab.id) {
      this.active_ = true;
      if (windowId !== this.tab.windowId) {
        // This tab has been moved to another window. We don't need to care
        // about the original window here, because if it still has tabs, one of
        // them will be activated.
        this.tab.windowId = windowId;
      }
      this.maybeUpdateWindowActiveTerminal();
    } else if (windowId === this.tab.windowId) {
      this.active_ = false;
    }
  }

  onUnload_() {
    // The clean-up logic will not be run if `unload` event is not fired
    // (e.g. the user logs out without closing the window), in which case,
    // we will have some rubbish left in localStorage. This is not likely to
    // become a problem, and we will solve this when we migrate to
    // sharedWorker.
    const activeTerminal = this.getWindowActiveTerminal();
    if (activeTerminal && activeTerminal.tabId === this.tab.id) {
      window.localStorage.removeItem(this.key);
    }
  }
}

