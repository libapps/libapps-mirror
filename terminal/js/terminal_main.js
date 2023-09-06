// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Initializes global state used in terminal.
 */

import {lib} from '../../libdot/index.js';
import {hterm} from '../../hterm/index.js';

import {terminal} from './terminal.js';
import {composeSshUrl, definePrefs, init, watchColors}
  from './terminal_common.js';
import './terminal_home_app.js';
import {getTerminalInfoTracker, setUpTitleHandler} from './terminal_info.js';

const globalInit = getTerminalInfoTracker().then((tracker) => {
  if (tracker.launchInfo.ssh?.needRedirect) {
    window.location.replace(composeSshUrl({
      settingsProfileId: tracker.launchInfo.settingsProfileId,
      ...tracker.launchInfo.ssh,
    }));
    return;
  }
  // TODO(crbug.com/999028): Make sure system web apps are not discarded as
  // part of the lifecycle API.  This fix used by crosh and nassh is not
  // guaranteed to be a long term solution.
  chrome.tabs?.update(tracker.tabId, {autoDiscardable: false});

  return tracker;
});

/**
 * Run the logic to show the the terminal home page.
 */
function runTerminalHome() {
  window.storage = chrome.terminalPrivate
      ? new lib.Storage.TerminalPrivate() : new lib.Storage.Local();

  const prefs = window.preferenceManager = new hterm.PreferenceManager(
      window.storage);
  definePrefs(prefs);
  // Dynamically change colors if settings change.
  const setColorRgbCssVar = (name, color) => {
    const css = lib.notNull(lib.colors.normalizeCSS(color));
    const rgb = lib.colors.crackRGB(css).slice(0, 3).join(',');
    document.body.style.setProperty(`--${name}-rgb`, rgb);
  };
  ['background-color', 'cursor-color', 'foreground-color'].forEach((p) => {
    prefs.addObserver(p, setColorRgbCssVar.bind(null, p));
  });
  prefs.addObserver('color-palette-overrides', (v) => {
    // Use ANSI bright blue (12) for buttons.
    const c = lib.colors.normalizeCSS(v[12] || lib.colors.stockPalette[12]);
    setColorRgbCssVar('button-color', c);
  });
  watchColors(prefs);
  prefs.readStorage(() => {
    prefs.notifyAll();
    document.body.style.overflow = 'auto';
    document.body.appendChild(document.createElement('terminal-home-app'));
  });
  // Ctrl+{N,P} for new window, settings page. Ignore Ctrl+T.
  const keyMaps = {
    'N': () => chrome.terminalPrivate.openWindow(),
    'P': () => chrome.terminalPrivate.openOptionsPage(() => {}),
    'T': () => {},
  };
  for (const [keyCode, f] of Object.entries(keyMaps)) {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.keyCode === keyCode.charCodeAt(0)) {
        f();
        e.preventDefault();
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  await init();
  const tracker = await globalInit;
  setUpTitleHandler(tracker);

  if (tracker.launchInfo.home) {
    runTerminalHome();
    return;
  }

  const div = document.createElement('div');
  div.id = 'terminal';
  document.body.appendChild(div);
  window.term_ = await terminal.init(div, tracker.launchInfo);
});
