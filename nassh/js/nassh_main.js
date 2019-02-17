// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Open a new window to the specified URL.
 *
 * We have to go through the background page in order to set chrome=no.
 * Normally Chrome will ignore it (for security reasons) when run in a
 * webpage or tab.  Extensions/apps are allowed to though, so grab the
 * background page and let it do the open for us.
 *
 * @param {string} url The URL to open.
 * @returns {Promise} A promise resolving once the window opens.
 */
const openNewWindow = function(url) {
  return new Promise((resolve) => {
    chrome.runtime.getBackgroundPage((bg) => {
      bg.window.lib.f.openWindow(
          url, '',
          'chrome=no,close=yes,resize=yes,scrollbars=yes,minimizable=yes,' +
          `width=${window.innerWidth},height=${window.innerHeight}`);
      resolve();
    });
  });
};

// CSP means that we can't kick off the initialization from the html file,
// so we do it like this instead.
window.onload = function() {
  // Workaround https://crbug.com/924656.
  if (nassh.workaroundMissingChromeRuntime()) {
    return;
  }

  const params = new URLSearchParams(document.location.search);

  // Allow users to bookmark links that open as a window.
  if (params.get('openas') == 'window') {
    // Delete the 'openas' string so we don't get into a loop.  We want to
    // preserve the rest of the query string when opening the window.
    params.delete('openas');
    const url = new URL(document.location);
    url.search = params.toString();
    openNewWindow(url.href).then(window.close);
    return;
  }

  var execNaSSH = function() {
    const profileName = params.get('profile');

    hterm.zoomWarningMessage = nassh.msg('ZOOM_WARNING');
    hterm.notifyCopyMessage = nassh.msg('NOTIFY_COPY');

    var terminal = new hterm.Terminal(profileName);
    terminal.decorate(document.querySelector('#terminal'));
    const runNassh = function() {
      terminal.setCursorPosition(0, 0);
      terminal.setCursorVisible(true);
      terminal.runCommandClass(nassh.CommandInstance,
                               document.location.hash.substr(1));
    };
    terminal.onTerminalReady = function() {
      if (window.chrome && chrome.accessibilityFeatures &&
          chrome.accessibilityFeatures.spokenFeedback) {
        chrome.accessibilityFeatures.spokenFeedback.onChange.addListener(
            (details) => terminal.setAccessibilityEnabled(details.value));
        chrome.accessibilityFeatures.spokenFeedback.get({}, function(details) {
          terminal.setAccessibilityEnabled(details.value);
          runNassh();
        });
      } else {
        runNassh();
      }
    };

    terminal.contextMenu.setItems([
      [nassh.msg('TERMINAL_CLEAR_MENU_LABEL'),
       function() { terminal.wipeContents(); }],
      [nassh.msg('TERMINAL_RESET_MENU_LABEL'),
       function() { terminal.reset(); }],
      [nassh.msg('NEW_WINDOW_MENU_LABEL'),
       function() { openNewWindow(lib.f.getURL('/html/nassh.html')); }],
      [nassh.msg('FAQ_MENU_LABEL'),
       function() { lib.f.openWindow('https://goo.gl/muppJj', '_blank'); }],
      [nassh.msg('CLEAR_KNOWN_HOSTS_MENU_LABEL'),
       function() { terminal.command.removeAllKnownHosts(); }],
      [nassh.msg('OPTIONS_BUTTON_LABEL'),
       function() { nassh.openOptionsPage(); }],
    ]);

    // Useful for console debugging.
    window.term_ = terminal;
    console.log(nassh.msg(
        'CONSOLE_NASSH_OPTIONS_NOTICE',
        [lib.f.getURL('/html/nassh_preferences_editor.html')]));
  };

  nassh.disableTabDiscarding();
  lib.init(execNaSSH, console.log.bind(console));
};
