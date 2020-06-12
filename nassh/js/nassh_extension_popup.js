// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * CSP means that we can't kick off the initialization from the html file,
 * so we do it like this instead.
 */
window.addEventListener('DOMContentLoaded', (event) => {
  nassh.loadWebFonts(document);
  lib.init().then(() => {
    // Save a handle for debugging.
    window.popup_ = new popup();
  });
});

/**
 * Manage the browser extension popup.
 *
 * @constructor
 */
function popup() {
  // The nassh global preference managers.
  this.prefs_ = new nassh.PreferenceManager();
  this.localPrefs_ = new nassh.LocalPreferenceManager();
  // The hterm pref manager.  We use the 'default' profile to theme.
  this.htermPrefs_ = new hterm.PreferenceManager('default');

  // Load the theme first so the style doesn't flicker.
  this.htermPrefs_.readStorage(() => {
    this.updateTheme_();
    this.prefs_.readStorage(() => {
      this.populateList_();
      this.localPrefs_.readStorage(() => {
        this.localPrefs_.syncProfiles(this.prefs_);
      });
    });
  });
}

/**
 * Open a specific connection.
 *
 * @param {!MouseEvent} e The event triggering this.
 */
popup.prototype.openLink_ = function(e) {
  const id = e.target.id;
  let profile;

  // Figure out whether to open a window or a tab.
  let mode;
  if (e.ctrlKey) {
    mode = 'tab';
  } else if (e.shiftKey) {
    mode = 'window';
  } else {
    // TODO: Get default from prefs.
    mode = 'window';
  }

  let url = lib.f.getURL('/html/nassh.html');
  switch (id) {
    case 'connect-dialog':
      break;
    case 'options':
      nassh.openOptionsPage();
      return;
    case 'feedback':
      nassh.sendFeedback();
      return;
    default: {
      profile = this.localPrefs_.getProfile(id);
      let openas = '';
      if (mode === 'window') {
        const state = profile.get('win/state');
        if (state !== 'normal') {
          openas = `openas=${state}`;
        }
      }
      url += `?promptOnReload=yes&${openas}#profile-id:${id}`;
      break;
    }
  }

  // Launch it.
  if (mode == 'tab') {
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
    lib.f.openWindow(url, '',
                     'chrome=no,close=yes,resize=yes,scrollbars=yes,' +
                     `minimizable=yes,top=${top},left=${left},` +
                     `height=${height},width=${width}`);
  }

  // Close the popup.  It happens automatically on some systems (e.g. Linux),
  // but not all (e.g. Chrome OS).
  window.close();
};

/**
 * Fill the popup with all the connections.
 */
popup.prototype.populateList_ = function() {
  // Create a copy since we're going to modify it in place below.
  const ids = this.prefs_.get('profile-ids').slice();
  ids.unshift('connect-dialog');
  ids.push('options');
  ids.push('feedback');

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];

    const link = document.createElement('div');
    link.title = nassh.msg('POPUP_CONNECT_TOOLTIP');
    link.id = id;
    link.className = 'links';
    link.addEventListener('click',
        /** @type {!EventListener} */ (this.openLink_.bind(this)));

    switch (id) {
      case 'connect-dialog':
        link.textContent = nassh.msg('CONNECTION_DIALOG_NAME');
        link.style.textAlign = 'center';
        break;
      case 'options':
        link.textContent = nassh.msg('HTERM_OPTIONS_BUTTON_LABEL');
        link.style.textAlign = 'center';
        break;
      case 'feedback':
        link.textContent = nassh.msg('SEND_FEEDBACK_LABEL');
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

/**
 * Style the popup with the right colors.
 */
popup.prototype.updateTheme_ = function() {
  let style = document.body.style;
  style.color = this.htermPrefs_.getString('foreground-color');
  style.backgroundColor = this.htermPrefs_.getString('background-color');
  style.fontSize = this.htermPrefs_.getNumber('font-size') + 'px';
  style.fontFamily = this.htermPrefs_.getString('font-family');
  if (style.webkitFontSmoothing !== undefined) {
    style.webkitFontSmoothing = this.htermPrefs_.getString('font-smoothing');
  }

  style = document.createElement('style');
  style.textContent = (
      'div.links:hover {' +
      `  background-color: ${this.htermPrefs_.getString('cursor-color')};` +
      '}'
  );
  document.head.appendChild(style);
};
