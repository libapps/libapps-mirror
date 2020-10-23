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
 * @return {!Promise} A promise resolving once the window opens.
 */
const openNewWindow = function(url) {
  const msg = {
    command: 'nassh',
    width: window.innerWidth,
    height: window.innerHeight,
    url: url,
    window: true,
  };
  return nassh.runtimeSendMessage(msg).then((response) => {
    if (response && response.error) {
      throw new Error(`request failed: ${response.message}`);
    }
  });
};

/**
 * CSP means that we can't kick off the initialization from the html file,
 * so we do it like this instead.
 */
window.addEventListener('DOMContentLoaded', (event) => {
  // Workaround https://crbug.com/924656.
  if (nassh.workaroundMissingChromeRuntime()) {
    return;
  }

  const params = new URLSearchParams(document.location.search);

  // Allow users to bookmark links that open as a window.
  const openas = params.get('openas');
  switch (openas) {
    case 'window': {
      // Delete the 'openas' string so we don't get into a loop.  We want to
      // preserve the rest of the query string when opening the window.
      params.delete('openas');
      const url = new URL(document.location.toString());
      url.search = params.toString();
      openNewWindow(url.href).then(() => window.close);
      return;
    }

    case 'fullscreen':
    case 'maximized':
      chrome.windows.getCurrent((win) => {
        chrome.windows.update(win.id, {state: openas});
      });
      break;
  }

  const execNaSSH = function() {
    const profileId = params.get('profile');

    const terminal = new hterm.Terminal({profileId});
    // TODO(crbug.com/1063219) We need this to not prompt the user for clipboard
    // permission.
    terminal.alwaysUseLegacyPasting = true;
    terminal.decorate(lib.notNull(document.querySelector('#terminal')));
    const runNassh = function() {
      terminal.onOpenOptionsPage = nassh.openOptionsPage;
      terminal.setCursorPosition(0, 0);
      terminal.setCursorVisible(true);
      terminal.runCommandClass(
          nassh.CommandInstance, 'nassh', [document.location.hash.substr(1)]);
    };
    terminal.onTerminalReady = function() {
      nassh.loadWebFonts(terminal.getDocument());
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
      {name: nassh.msg('TERMINAL_CLEAR_MENU_LABEL'),
       action: function() { terminal.wipeContents(); }},
      {name: nassh.msg('TERMINAL_RESET_MENU_LABEL'),
       action: function() { terminal.reset(); }},
      {name: nassh.msg('NEW_WINDOW_MENU_LABEL'),
       action: function() { openNewWindow(lib.f.getURL('/html/nassh.html')); }},
      {name: nassh.msg('FAQ_MENU_LABEL'),
       action: function() {
         lib.f.openWindow('https://goo.gl/muppJj', '_blank');
       }},
      {name: nassh.msg('CLEAR_KNOWN_HOSTS_MENU_LABEL'),
       action: function() { nassh.openOptionsPage('ssh-files'); }},
      {name: nassh.msg('HTERM_OPTIONS_BUTTON_LABEL'),
       action: function() { nassh.openOptionsPage(); }},
      {name: nassh.msg('SEND_FEEDBACK_LABEL'),
       action: nassh.sendFeedback},
    ]);

    // Useful for console debugging.
    window.term_ = terminal;
    console.log(nassh.msg(
        'CONSOLE_NASSH_OPTIONS_NOTICE',
        [lib.f.getURL('/html/nassh_preferences_editor.html')]));
  };

  nassh.disableTabDiscarding();
  lib.init(console.log.bind(console)).then(execNaSSH);
});
