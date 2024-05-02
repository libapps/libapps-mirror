// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../../libdot/index.js';

import {browserAction, localize, sendFeedback} from './nassh.js';
import {
  LocalPreferenceManager, PreferenceManager,
} from './nassh_preference_manager.js';

/**
 * The singleton app instance for the nassh packaged app, created by the
 * background page.
 *
 * @param {!lib.Storage} storage Storage for sync settings.
 * @constructor
 */
export function App(storage) {
  this.prefs_ = new PreferenceManager(storage);
  this.localPrefs_ = new LocalPreferenceManager();
  this.omniMatches_ = [];
  this.omniDefault_ = null;

  this.prefs_.readStorage();
  this.localPrefs_.readStorage();
}

/**
 * Set up context menus.
 *
 * NB: We omit "Options" because Chrome takes care of populating that entry.
 */
App.prototype.installContextMenus = function() {
  // Remove any previous entries.  This comes up when reloading the page.
  chrome.contextMenus.removeAll();

  chrome.contextMenus.onClicked.addListener(this.onContextMenu_.bind(this));

  /** @type {!Array<!chrome.contextMenus.CreateProperties>} */
  const entries = [
    {
      'type': 'normal',
      'id': 'connect-dialog',
      'title': localize('CONNECTION_DIALOG_NAME'),
      'contexts': ['action'],
    },
    {
      'type': 'normal',
      'id': 'mosh',
      'title': localize('MOSH_NAME'),
      'contexts': ['action'],
    },
    {
      'type': 'normal',
      'id': 'feedback',
      'title': localize('SEND_FEEDBACK_LABEL'),
      'contexts': ['action'],
    },
  ];
  entries.forEach((entry) => chrome.contextMenus.create(entry));
};

/**
 * Callback from context menu clicks.
 *
 * @param {!Object} info The item clicked.
 * @param {!Tab=} tab When relevant, the active tab.
 */
App.prototype.onContextMenu_ = function(info, tab = undefined) {
  switch (info.menuItemId) {
    case 'connect-dialog':
      lib.f.openWindow(lib.f.getURL('/html/nassh_connect_dialog.html'), '',
                       'chrome=no,close=yes,resize=yes,minimizable=yes,' +
                       'scrollbars=yes,width=900,height=600');
      break;
    case 'mosh':
      lib.f.openWindow(
          lib.f.getURL('/plugin/mosh/mosh_client.html'), '',
          'chrome=no,close=yes,resize=yes,minimizable=yes,' +
          'scrollbars=yes,width=900,height=600');
      break;
    case 'feedback':
      sendFeedback();
      break;
    default:
      console.error('Unknown menu item', info);
      break;
  }
};

/**
 * Set the default help text in the omnibox when completing an ssh connection.
 */
App.prototype.setDefaultOmnibox_ = function() {
  this.omnibox_.setDefaultSuggestion({
    description: localize('OMNIBOX_DEFAULT'),
  });
};

/**
 * Callback when user first interacts with the ssh shortcut.
 */
App.prototype.omniboxOnInputStarted_ = function() {
  this.omniMatches_.length = 0;
  this.omniDefault_ = null;

  // Convert a nassh profile into an object we can easily match later on.
  const profileIdToOmni = (id) => {
    const profile = this.prefs_.getProfile(id);

    let port = profile.get('port') || '';
    if (port) {
      port = ':' + port;
    }

    return {
      uhp: profile.get('username') + '@' + profile.get('hostname') + port,
      desc: profile.get('description'),
      id: id,
    };
  };

  // Read our saved settings and construct the partial matches from all of
  // our active profiles.
  const ids = this.prefs_.get('profile-ids');
  for (let i = 0; i < ids.length; ++i) {
    this.omniMatches_.push(profileIdToOmni(ids[i]));
  }

  // When first installed, there won't be a last profile.
  const lastProfile = this.localPrefs_.get('connectDialog/lastProfileId');
  if (lastProfile) {
    this.omniDefault_ = profileIdToOmni(lastProfile);
  }
};

/**
 * Callback when the user changes the input at all.
 *
 * @param {string} text Current input in the omnibox.
 * @param {function(!Array<{content: string, description: string}>)} suggest
 *     Function for us to call to notify of our matches against the text.
 */
App.prototype.omniboxOnInputChanged_ = function(text, suggest) {
  const resultsUhp = [];
  const resultsDescLeading = [];
  const resultsDescSubstr = [];

  this.omniMatches_.forEach((match) => {
    if (match.uhp.startsWith(text)) {
      resultsUhp.push({
        content: `profile-id=${match.id}`,
        description: lib.f.replaceVars(
          '<match>%escapeHTML(uhp)</match>: %escapeHTML(desc)', match),
      });
    }

    if (match.desc.startsWith(text)) {
      resultsDescLeading.push({
        content: `profile-id=${match.id}`,
        description: lib.f.replaceVars(
          '%escapeHTML(uhp): <match>%escapeHTML(desc)</match>', match),
      });
    }

    if (match.desc.includes(text)) {
      resultsDescSubstr.push({
        content: `profile-id=${match.id}`,
        description: lib.f.replaceVars(
          '%escapeHTML(uhp): <match>%escapeHTML(desc)</match>', match),
      });
    }
  });

  // Now merge the suggestions together in order.
  const results = resultsUhp.concat(resultsDescLeading, resultsDescSubstr);
  if (results.length == 0 || text.trim().length == 0) {
    // If they're just starting input, or if we have no matches, then show the
    // last connection used first.
    if (this.omniDefault_) {
      results.unshift({
        content: `profile-id=${this.omniDefault_.id}`,
        description: lib.f.replaceVars('%escapeHTML(uhp): %escapeHTML(desc)',
                                       this.omniDefault_),
      });
    }
  }
  if (results.length) {
    suggest(results);
  }
};

/**
 * Callback when the user has finish entering text.
 *
 * See the omnibox source for what key strokes generate which dispositions.
 * https://chromium.googlesource.com/chromium/src/+/69.0.3487.1/chrome/browser/ui/views/omnibox/omnibox_view_views.cc#1188
 *
 * @param {string} text The text to operate on.
 * @param {string} disposition Mode the user wants us to open as.
 */
App.prototype.omniboxOnInputEntered_ = function(text, disposition) {
  // If the user types out the profile name exactly, connect to it.  It might
  // overlap with a valid URI, but if that's a problem, they can change the
  // description to something else.
  for (let i = 0; i < this.omniMatches_.length; ++i) {
    const match = this.omniMatches_[i];

    if (match.desc == text) {
      text = `profile-id=${match.id}`;
      break;
    }
  }

  // If the user typed user@host directly, connect to it via hash.  If they
  // matched a saved profile, pass it via query string.
  const delim = text.startsWith('profile-id=') ? '?' : '#';

  const url = lib.f.getURL(`/html/nassh.html${delim}${text}`);
  switch (disposition) {
    default:
      console.warn('unknown disposition: ' + disposition);
    case 'currentTab':
      // Fired when pressing Enter.
      // Ideally we'd just call chrome.tabs.update, but that won't focus the
      // new ssh session.  We close the current tab and then open a new one
      // right away -- Chrome will focus the content for us.
      //
      // TODO(crbug.com/1075427#c6): Incognito mode is a bit buggy, so we have
      // to use getCurrent+windowId instead of currentWindow directly for now.
      chrome.windows.getCurrent((win) => {
        chrome.tabs.query({active: true, windowId: win.id}, (tabs) => {
          chrome.tabs.remove(tabs[0].id);
        });

        chrome.tabs.create({windowId: win.id, url: url, active: true});
      });
      break;
    case 'newBackgroundTab':
      // Fired when pressing Meta+Enter/Command+Enter.
      chrome.tabs.create({url: url, active: false});
      break;
    case 'newForegroundTab':
      // Fired when pressing Alt+Enter.
      // Close the active tab.  We need to do this before opening a new window
      // in case Chrome selects that as the new active tab.  It won't kill us
      // right away though as the JS execution model guarantees we'll finish
      // running this func before the callback runs.
      //
      // TODO(crbug.com/1075427#c6): Incognito mode is a bit buggy, so we have
      // to use getCurrent+windowId instead of currentWindow directly for now.
      chrome.windows.getCurrent((win) => {
        chrome.tabs.query({active: true, windowId: win.id}, (tabs) => {
          chrome.tabs.remove(tabs[0].id);
        });
      });
      // We'll abuse this to open a window instead of a tab.
      lib.f.openWindow(url, '',
                       'chrome=no,close=yes,resize=yes,minimizable=yes,' +
                       'scrollbars=yes,width=900,height=600');
      break;
  }
};

/**
 * Callback when the user has aborted input.
 */
App.prototype.omniboxOnInputCancelled_ = function() {
//  this.setDefaultOmnibox_(); needed?
  this.omniMatches_.length = 0;
  this.omniDefault_ = null;
};

/**
 * Bind our callbacks to the omnibox.
 *
 * @param {!typeof chrome.omnibox} omnibox The omnibox instance to bind to.
 */
App.prototype.installOmnibox = function(omnibox) {
  this.omnibox_ = omnibox;
  this.setDefaultOmnibox_();
  omnibox.onInputStarted.addListener(this.omniboxOnInputStarted_.bind(this));
  omnibox.onInputChanged.addListener(this.omniboxOnInputChanged_.bind(this));
  omnibox.onInputEntered.addListener(this.omniboxOnInputEntered_.bind(this));
  omnibox.onInputCancelled.addListener(
    this.omniboxOnInputCancelled_.bind(this));
};

/**
 * Bind our callbacks to the browser action button (for extensions).
 */
App.prototype.installBrowserAction = function() {
  if (!browserAction) {
    return;
  }

  browserAction.onClicked.addListener(this.onLaunched.bind(this));
};

/**
 * Called on app launch.
 */
App.prototype.onLaunched = function() {
  const width = 900;
  const height = 600;
  lib.f.openWindow(lib.f.getURL('/html/nassh_connect_dialog.html'), '',
                   'chrome=no,close=yes,resize=yes,scrollbars=yes,' +
                   `minimizable=yes,width=${width},height=${height}`);
};
