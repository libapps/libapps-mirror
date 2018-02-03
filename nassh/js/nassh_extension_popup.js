// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * CSP means that we can't kick off the initialization from the html file,
 * so we do it like this instead.
 */
window.onload = function() {
  lib.init(() => new popup());
};

/**
 * Manage the browser extension popup.
 */
function popup() {
  // The nassh global pref manager.
  this.prefs_ = new nassh.PreferenceManager();
  // The hterm pref manager.  We use the 'default' profile to theme.
  this.htermPrefs_ = new hterm.PreferenceManager('default');

  // Load the theme first so the style doesn't flicker.
  this.htermPrefs_.readStorage(() => {
    this.updateTheme_();
    this.prefs_.readStorage(() => this.populateList_());
  });
}

/**
 * Open a specific connection.
 *
 * @param {MouseEvent} e The event triggering this.
 */
popup.prototype.openLink_ = function(e) {
  const id = e.target.id;

  let url = lib.f.getURL('/html/nassh.html');
  switch (id) {
    case 'connect-dialog':
      break;
    case 'options':
      nassh.openOptionsPage();
      return;
    default:
      url += `#profile-id:${id}`;
      break;
  }

  // Figure out whether to open a window or a tab.
  let mode;
  if (e.ctrlKey)
    mode = 'tab';
  else if (e.shiftKey)
    mode = 'window';
  else
    mode = 'window';  // TODO: Get default from prefs.

  // Launch it.
  if (mode == 'tab') {
    // Should we offer a way to open tabs in the background?
    chrome.tabs.create({url: url, active: true});
  } else {
    window.open(url, '',
                'chrome=no,close=yes,resize=yes,scrollbars=yes,' +
                'minimizable=yes,width=900,height=600');
  }

  // Close the popup.  It happens automatically on some systems (e.g. Linux),
  // but not all (e.g. Chrome OS).
  window.close();
};

/**
 * Fill the popup with all the connections.
 */
popup.prototype.populateList_ = function() {
  const ids = this.prefs_.get('profile-ids');
  ids.unshift('connect-dialog');
  ids.push('options');

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];

    const link = document.createElement('div');
    link.id = id;
    link.className = 'links';
    link.addEventListener('click', this.openLink_.bind(this));

    switch (id) {
      case 'connect-dialog':
        link.textContent = nassh.msg('CONNECTION_DIALOG_NAME');
        link.style.textAlign = 'center';
        break;
      case 'options':
        link.textContent = nassh.msg('OPTIONS_BUTTON_LABEL');
        link.style.textAlign = 'center';
        break;
      default:
        const profile = this.prefs_.getProfile(id);
        const desc = profile.get('description');
        link.textContent = desc;
        break;
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
  style.color = this.htermPrefs_.get('foreground-color');
  style.backgroundColor = this.htermPrefs_.get('background-color');
  style.fontSize = this.htermPrefs_.get('font-size') + 'px';
  style.fontFamily = this.htermPrefs_.get('font-family');
  if (style.webkitFontSmoothing !== undefined)
    style.webkitFontSmoothing = this.htermPrefs_.get('font-smoothing');

  style = document.createElement('style');
  style.textContent = (
      'div.links:hover {' +
      `  background-color: ${this.htermPrefs_.get('cursor-color')};` +
      '}'
  );
  document.head.appendChild(style);
};
