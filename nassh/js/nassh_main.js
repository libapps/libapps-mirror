// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.f', 'hterm');

// CSP means that we can't kick off the initialization from the html file,
// so we do it like this instead.
window.onload = function() {
  var app;

  var updateNotification = document.querySelector('#update-notification');
  updateNotification.title = nassh.msg('UPDATE_AVAILABLE_TOOLTIP');
  updateNotification.addEventListener('click', function() {
      updateNotification.style.display = 'none';
    });

  var execNaSSH = function() {
    var profileName = lib.f.parseQuery(document.location.search)['profile'];

    hterm.zoomWarningMessage = nassh.msg('ZOOM_WARNING');
    hterm.notifyCopyMessage = nassh.msg('NOTIFY_COPY');

    var terminal = new hterm.Terminal(profileName);
    terminal.decorate(document.querySelector('#terminal'));
    terminal.onTerminalReady = function() {
        terminal.setCursorPosition(0, 0);
        terminal.setCursorVisible(true);
        terminal.runCommandClass(nassh.CommandInstance,
                                 document.location.hash.substr(1));
    };

    // Useful for console debugging.
    window.term_ = terminal;
  }

  var onUpdateAvailable = function() {
    updateNotification.style.display = '';
  };

  window.onunload = function() {
    if (app)
      app.onUpdateAvailable.removeListener(onUpdateAvailable);
  };

  chrome.runtime.getBackgroundPage(function(bg) {
      if (!bg)
        return;

      app = bg.app;

      // Exported for console debugging.
      window.app_ = app;

      app.onUpdateAvailable.addListener(onUpdateAvailable);
      if (app.updateAvailable)
        onUpdateAvailable();

      lib.init(execNaSSH, console.log.bind(console));
    });
};
