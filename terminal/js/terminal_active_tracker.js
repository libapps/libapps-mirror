// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @typedef {{
 *            tabId: number,
 *            terminalId: string,
 *            title: string,
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

    /** @public {?string} */
    this.terminalId_;

    chrome.tabs.onActivated.addListener((e) => this.onTabActivated_(e));
    window.addEventListener('unload', () => this.onUnload_());
  }

  get terminalId() {
    return this.terminalId_;
  }

  set terminalId(terminalId) {
    this.terminalId_ = terminalId;
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
    return `windowActiveTerminal-${windowId}`;
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
    if (this.terminalId_ && this.active_) {
      window.localStorage.setItem(
          this.key,
          JSON.stringify({
            tabId: this.tab.id,
            terminalId: this.terminalId_,
            title: document.title,
          }));
    }
  }

  onTabActivated_({tabId, windowId}) {
    if (windowId === this.tab.windowId) {
      this.active_ = tabId === this.tab.id;
      this.maybeUpdateWindowActiveTerminal();
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

