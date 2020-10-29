// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * The singleton app instance for the nassh packaged app, created by the
 * background page.
 *
 * @constructor
 */
nassh.App = function() {
  this.prefs_ = new nassh.PreferenceManager();
  this.localPrefs_ = new nassh.LocalPreferenceManager();
  this.omniMatches_ = [];
  this.omniDefault_ = null;

  this.prefs_.readStorage();
  this.localPrefs_.readStorage();
};

/**
 * Set up the file system provider APIs.
 */
nassh.App.prototype.installFsp = function() {
  nassh.sftp.fsp.addListeners();
};

/**
 * Set the default help text in the omnibox when completing an ssh connection.
 */
nassh.App.prototype.setDefaultOmnibox_ = function() {
  this.omnibox_.setDefaultSuggestion({
    description: nassh.msg('OMNIBOX_DEFAULT'),
  });
};

/**
 * Callback when user first interacts with the ssh shortcut.
 */
nassh.App.prototype.omniboxOnInputStarted_ = function() {
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

  this.omniDefault_ = profileIdToOmni(
      this.localPrefs_.get('connectDialog/lastProfileId'));
};

/**
 * Callback when the user changes the input at all.
 *
 * @param {string} text Current input in the omnibox.
 * @param {function(!Array<{content: string, description: string}>)} suggest
 *     Function for us to call to notify of our matches against the text.
 */
nassh.App.prototype.omniboxOnInputChanged_ = function(text, suggest) {
  const resultsUhp = [];
  const resultsDescLeading = [];
  const resultsDescSubstr = [];

  this.omniMatches_.forEach((match) => {
    if (match.uhp.startsWith(text)) {
      resultsUhp.push({
        content: 'profile-id:' + match.id,
        description: lib.f.replaceVars(
          '<match>%escapeHTML(uhp)</match>: %escapeHTML(desc)', match),
      });
    }

    if (match.desc.startsWith(text)) {
      resultsDescLeading.push({
        content: 'profile-id:' + match.id,
        description: lib.f.replaceVars(
          '%escapeHTML(uhp): <match>%escapeHTML(desc)</match>', match),
      });
    }

    if (match.desc.includes(text)) {
      resultsDescSubstr.push({
        content: 'profile-id:' + match.id,
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
        content: 'profile-id:' + this.omniDefault_.id,
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
nassh.App.prototype.omniboxOnInputEntered_ = function(text, disposition) {
  // If the user types out the profile name exactly, connect to it.  It might
  // overlap with a valid URI, but if that's a problem, they can change the
  // description to something else.
  for (let i = 0; i < this.omniMatches_.length; ++i) {
    const match = this.omniMatches_[i];

    if (match.desc == text) {
      text = 'profile-id:' + match.id;
      break;
    }
  }

  const url = chrome.runtime.getURL('/html/nassh.html#' + text);
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
nassh.App.prototype.omniboxOnInputCancelled_ = function() {
//  this.setDefaultOmnibox_(); needed?
  this.omniMatches_.length = 0;
  this.omniDefault_ = null;
};

/**
 * Bind our callbacks to the omnibox.
 *
 * @param {!typeof chrome.omnibox} omnibox The omnibox instance to bind to.
 */
nassh.App.prototype.installOmnibox = function(omnibox) {
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
nassh.App.prototype.installBrowserAction = function() {
  if (!nassh.browserAction) {
    return;
  }

  nassh.browserAction.onClicked.addListener(this.onLaunched.bind(this));
};

/**
 * Called on app launch.
 */
nassh.App.prototype.onLaunched = function() {
  const width = 900;
  const height = 600;
  lib.f.openWindow(lib.f.getURL('/html/nassh.html'), '',
                   'chrome=no,close=yes,resize=yes,scrollbars=yes,' +
                   `minimizable=yes,width=${width},height=${height}`);
};
