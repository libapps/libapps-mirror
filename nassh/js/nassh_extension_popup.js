// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../../libdot/index.js';

import {hterm} from '../../hterm/index.js';

import {
  getSyncStorage, localize, openOptionsPage, sendFeedback,
} from './nassh.js';
import {
  LocalPreferenceManager, PreferenceManager,
} from './nassh_preference_manager.js';

/**
 * CSP means that we can't kick off the initialization from the html file,
 * so we do it like this instead.
 */
globalThis.addEventListener('DOMContentLoaded', async (event) => {
  await hterm.initPromise;

  // Save a handle for debugging.
  globalThis.popup_ = new popup();
});

/**
 * Manage the browser extension popup.
 *
 * @constructor
 */
function popup() {
  const storage = getSyncStorage();

  // The nassh global preference managers.
  this.prefs_ = new PreferenceManager(storage);
  this.localPrefs_ = new LocalPreferenceManager();
  // The hterm pref manager.  We use the 'default' profile to theme.
  this.htermPrefs_ = new hterm.PreferenceManager(storage);

  // Load the theme first so the style doesn't flicker.
  this.htermPrefs_.readStorage().then(() => {
    this.prefs_.readStorage().then(() => {
      // If there aren't any connections yet, pop open the connection dialog
      // automatically.  This will force users to register one first.
      const ids = this.prefs_.get('profile-ids');
      if (ids.length === 0) {
        this.openLink_('connect-dialog', openModes.WINDOW);
        return;
      }

      this.populateList_();
      this.localPrefs_.readStorage().then(() => {
        this.localPrefs_.syncProfiles(this.prefs_);
      });
    });
  });
}

/**
 * Different ways of opening links.
 *
 * @enum {string}
 */
const openModes = {
  FOREGROUND_TAB: 'foreground-tab',
  WINDOW: 'window',
  WINDOW_TAB: 'window+tab',
};

/**
 * Open a specific connection.
 *
 * @param {string} id The profile id to open.
 * @param {!openModes} openMode How to open the link.
 */
popup.prototype.openLink_ = function(id, openMode) {
  let profile;

  let url = lib.f.getURL('/html/nassh.html');
  switch (id) {
    case 'connect-dialog':
      url = lib.f.getURL('/html/nassh_connect_dialog.html');
      break;
    case 'options':
      openOptionsPage();
      return;
    case 'feedback':
      sendFeedback();
      return;
    case 'mosh':
      url = lib.f.getURL('/plugin/mosh/mosh_client.html');
    default: {
      if (id != 'mosh') {
        profile = this.localPrefs_.getProfile(id);
      }
      let openas = '';
      if (openMode === openModes.WINDOW) {
        const state = profile ? profile.get('win/state') : '';
        if (state !== 'normal') {
          openas = `openas=${state}&`;
        }
      }
      url += `?${openas}profile-id=${id}`;
      break;
    }
  }

  // Launch it.
  if (openMode === openModes.FOREGROUND_TAB) {
    // Should we offer a way to open tabs in the background?
    chrome.tabs.create({url: url, active: true});
  } else {
    let top = 0;
    let left = 0;
    let height = 600;
    let width = 900;
    let profile;
    try {
      profile = this.localPrefs_.getProfile(id);
    } catch (e) {
      // Ignore errors here to make the UI more robust.  And this ignores the
      // saved settings for connect-dialog which we don't track currently.
    }
    if (profile) {
      const parseDim = (value, fallback) => {
        const ret = parseInt(value, 10);
        return isNaN(ret) ? fallback : ret;
      };
      top = parseDim(profile.get('win/top'), top);
      left = parseDim(profile.get('win/left'), left);
      height = parseDim(profile.get('win/height'), height);
      width = parseDim(profile.get('win/width'), width);
    }

    if (openMode === openModes.WINDOW_TAB) {
      chrome.windows.create({
        url: url,
        top: top,
        left: left,
        width: width,
        height: height,
        focused: true,
      });
    } else {
      lib.f.openWindow(url, '',
                       'chrome=no,close=yes,resize=yes,scrollbars=yes,' +
                       `minimizable=yes,top=${top},left=${left},` +
                       `height=${height},width=${width}`);
    }
  }

  // Close the popup.  It happens automatically on some systems (e.g. Linux),
  // but not all (e.g. ChromeOS).
  globalThis.close();
};

/**
 * Open a specific connection via mouse clicks.
 *
 * @param {!MouseEvent} e The event triggering this.
 */
popup.prototype.mouseClickLink_ = function(e) {
  // We route multiple event types here.
  if (e.type === 'auxclick') {
    // Only consume middle mouse.  Leave other buttons for future use.
    if (e.button != 1) {
      return;
    }
  }

  // Figure out whether to open a window or a tab.
  let openMode;
  if ((hterm.os !== 'mac' && e.ctrlKey) ||
      (hterm.os === 'mac' && e.metaKey) ||
      e.type === 'auxclick') {
    openMode = openModes.FOREGROUND_TAB;
  } else if (e.shiftKey) {
    openMode = openModes.WINDOW_TAB;
  } else {
    // TODO: Get default from prefs.
    openMode = openModes.WINDOW;
  }

  this.openLink_(e.target.id, openMode);
};

/**
 * Open a specific connection via the keyboard.
 *
 * @param {!KeyboardEvent} e The event triggering this.
 */
popup.prototype.keyupLink_ = function(e) {
  switch (e.key) {
    case 'Enter': {
      // Figure out whether to open a window or a tab.
      let openMode;
      if ((hterm.os !== 'mac' && e.ctrlKey) ||
          (hterm.os === 'mac' && e.metaKey)) {
        openMode = openModes.FOREGROUND_TAB;
      } else if (e.shiftKey) {
        openMode = openModes.WINDOW_TAB;
      } else {
        // TODO: Get default from prefs.
        openMode = openModes.WINDOW;
      }

      this.openLink_(e.target.id, openMode);
      e.preventDefault();
      break;
    }
  }
};

/**
 * When a key is pressed down.
 *
 * @param {!KeyboardEvent} e The event triggering this.
 */
popup.prototype.keydownWindow_ = function(e) {
  // Helper to find the last focusable element.
  const findLastFocusElement = () => {
    let ret;
    document.querySelectorAll('[tabIndex]').forEach((ele) => {
      if (!ret || ret.tabIndex < ele.tabIndex) {
        ret = ele;
      }
    });
    return ret;
  };

  // Helper to find the first focusable element.
  const findFirstFocusElement = () => {
    let ret;
    document.querySelectorAll('[tabIndex]').forEach((ele) => {
      if (!ret || ret.tabIndex > ele.tabIndex) {
        ret = ele;
      }
    });
    return ret;
  };

  switch (e.key) {
    case 'PageUp':
    case 'ArrowUp':
    case 'ArrowLeft': {
      // Move focus to the previous entry.
      const tabIndex = e.target.tabIndex - 1;
      let ele = document.querySelector(`[tabIndex="${tabIndex}"]`);
      if (ele === null) {
        ele = findLastFocusElement();
      }
      ele.focus();
      e.preventDefault();
      break;
    }

    case 'PageDown':
    case 'ArrowDown':
    case 'ArrowRight': {
      // Move focus to the next entry.
      const tabIndex = e.target.tabIndex + 1;
      let ele = document.querySelector(`[tabIndex="${tabIndex}"]`);
      if (ele === null) {
        ele = findFirstFocusElement();
      }
      ele.focus();
      e.preventDefault();
      break;
    }

    case 'Home':
      findFirstFocusElement().focus();
      e.preventDefault();
      break;

    case 'End':
      findLastFocusElement().focus();
      e.preventDefault();
      break;
  }
};

/**
 * Fill the popup with all the connections.
 */
popup.prototype.populateList_ = function() {
  // Create a copy since we're going to modify it in place below.
  const ids = this.prefs_.get('profile-ids').slice();
  ids.unshift('connect-dialog');
  ids.push('mosh');
  ids.push('options');
  ids.push('feedback');

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];

    const link = document.createElement('div');
    link.title = localize('POPUP_CONNECT_TOOLTIP');
    link.id = id;
    link.tabIndex = i + 1;
    link.className = 'links';
    const mouseClick = /** @type {!EventListener} */ (
        this.mouseClickLink_.bind(this));
    link.addEventListener('click', mouseClick);
    link.addEventListener('auxclick', mouseClick);
    link.addEventListener('keyup', /** @type {!EventListener} */ (
        this.keyupLink_.bind(this)));

    switch (id) {
      case 'connect-dialog':
        link.textContent = localize('CONNECTION_DIALOG_NAME');
        link.style.textAlign = 'center';
        link.style.borderBottom = 'dashed 1px';
        break;
      case 'mosh':
        link.textContent = localize('MOSH_NAME');
        link.style.textAlign = 'center';
        link.style.borderTop = 'dashed 1px';
        break;
      case 'options':
        link.textContent = localize('HTERM_OPTIONS_BUTTON_LABEL');
        link.style.textAlign = 'center';
        break;
      case 'feedback':
        link.textContent = localize('SEND_FEEDBACK_LABEL');
        link.style.textAlign = 'center';
        break;
      default: {
        const profile = this.prefs_.getProfile(id);
        const desc = profile.get('description');
        link.textContent = desc;
        break;
      }
    }

    document.body.appendChild(link);
  }

  globalThis.addEventListener('keydown', /** @type {!EventListener} */ (
      this.keydownWindow_.bind(this)));

  // Workaround bugs on Chrome on macOS where the popup renders as a small box
  // due to the body dimenions being unset.  https://crbug.com/428044
  if (hterm.os == 'mac') {
    // This height calculation is excessive due to padding, but it's not worth
    // the extra coding effort to get it pixel-perfect (e.g. getComputedStyle).
    const height = document.body.clientHeight;
    // Set it slightly bigger immediately so hopefully this will lead to less
    // flashing/refreshing.  It's not clear whether this always worksaround the
    // bug though :(.
    document.body.style.height = `${height + 1}px`;
    // Schedule an update in case the window is still too small.  Hopefully
    // this will catch the rest.  If we already workedaround it, we'll only
    // make the window slightly bigger so the user won't notice.
    setTimeout(() => document.body.style.height = `${height + 2}px`, 50);
  }
};
