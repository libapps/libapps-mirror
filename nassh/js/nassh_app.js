// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.Event');

/**
 * The singleton app instance for the nassh packaged app, created by the
 * background page.
 */
nassh.App = function(manifest) {
  this.updateAvailable = false;

  this.onInit = new lib.Event();
  this.onUpdateAvailable = new lib.Event(this.onUpdateAvailable_.bind(this));

  chrome.runtime.onUpdateAvailable.addListener(this.onUpdateAvailable);

  this.prefs_ = new nassh.PreferenceManager();
  this.omniMatches_ = [];
  this.omniDefault_ = null;
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
  var profileIdToOmni = function(id) {
    var profile = this.prefs_.getProfile(id);

    var port = profile.get('port');
    if (port)
      port = ':' + port;

    return {
      uhp: profile.get('username') + '@' + profile.get('hostname') + port,
      desc: profile.get('description'),
      id: id,
    };
  };

  // Read our saved settings and construct the partial matches from all of
  // our active profiles.
  this.prefs_.readStorage(() => {
    var ids = this.prefs_.get('profile-ids');
    for (var i = 0; i < ids.length; ++i)
      this.omniMatches_.push(profileIdToOmni.call(this, ids[i]));

    chrome.storage.local.get('/nassh/connectDialog/lastProfileId',
      (items) => {
        var lastProfileId = items['/nassh/connectDialog/lastProfileId'];
        if (lastProfileId)
          this.omniDefault_ = profileIdToOmni.call(this, lastProfileId);
      });
  });
};

/**
 * Callback when the user changes the input at all.
 *
 * @param {string} text Current input in the omnibox.
 * @param {function} suggest Function for us to call to notify of our
 *     matches against the text.
 */
nassh.App.prototype.omniboxOnInputChanged_ = function(text, suggest) {
  var resultsUhp = [];
  var resultsDescLeading = [];
  var resultsDescSubstr = [];

  this.omniMatches_.forEach((match) => {
    if (match.uhp.startsWith(text))
      resultsUhp.push({
        content: 'profile-id:' + match.id,
        description: lib.f.replaceVars(
          '<match>%escapeHTML(uhp)</match>: %escapeHTML(desc)', match),
      });

    if (match.desc.startsWith(text))
      resultsDescLeading.push({
        content: 'profile-id:' + match.id,
        description: lib.f.replaceVars(
          '%escapeHTML(uhp): <match>%escapeHTML(desc)</match>', match),
      });

    if (match.desc.includes(text))
      resultsDescSubstr.push({
        content: 'profile-id:' + match.id,
        description: lib.f.replaceVars(
          '%escapeHTML(uhp): <match>%escapeHTML(desc)</match>', match),
      });
  });

  // Now merge the suggestions together in order.
  var results = resultsUhp.concat(resultsDescLeading, resultsDescSubstr);
  if (results.length == 0 || text.trim().length == 0) {
    // If they're just starting input, or if we have no matches, then show the
    // last connection used first.
    if (this.omniDefault_)
      results.unshift({
        content: 'profile-id:' + this.omniDefault_.id,
        description: lib.f.replaceVars('%escapeHTML(uhp): %escapeHTML(desc)',
                                       this.omniDefault_),
      });
  }
  if (results.length)
    suggest(results);
};

/**
 * Callback when the user has finish entering text.
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

  var url = chrome.runtime.getURL('html/nassh.html#' + text);
  switch (disposition) {
    default:
      console.warn('unknown disposition: ' + disposition);
    case 'currentTab':
      // Ideally we'd just call chrome.tabs.update, but that won't focus the
      // new ssh session.  We close the current tab and then open a new one
      // right away -- Chrome will focus the content for us.
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.remove(tabs[0].id);
      });
      chrome.tabs.create({url: url, active: true});
      break;
    case 'newBackgroundTab':
      chrome.tabs.create({url: url, active: false});
      break;
    case 'newForegroundTab':
      // Close the active tab.  We need to do this before opening a new window
      // in case Chrome selects that as the new active tab.  It won't kill us
      // right away though as the JS execution model guarantees we'll finish
      // running this func before the callback runs.
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.remove(tabs[0].id);
      });
      // We'll abuse this to open a window instead of a tab.
      window.open(url, '',
                  'chrome=no,close=yes,resize=yes,minimizable=yes,' +
                  'scrollbars=yes,width=900,height=600,noopener');
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
 * @param {object} omnibox The omnibox instance to bind to.
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
 * Bind our callbacks to the runtime.
 *
 * @param {object} runtime The runtime instance to bind to.
 */
nassh.App.prototype.installHandlers = function(runtime) {
  runtime.onLaunched.addListener(this.onLaunched.bind(this));
  runtime.onRestarted.addListener(this.onLaunched.bind(this));
};

nassh.App.prototype.onLaunched = function(e) {
  chrome.app.window.create('/html/nassh.html', {
    'bounds': {
      'width': 900,
      'height': 600
    },
    'id': 'mainWindow'
  });
};

nassh.App.prototype.onUpdateAvailable_ = function(e) {
  this.updateAvailable = true;

  var onQuery = function(rv) {
    if (!rv.length) {
      console.log('Reloading for update.');
      chrome.runtime.reload();
    } else {
      console.log('Not reloading for update, ' + rv.length +
                  ' windows still open.');
    }
  };

  var checkTabs = function() {
    chrome.tabs.query({url: chrome.runtime.getURL('html/nassh.html')},
                      onQuery);
  };

  chrome.tabs.onRemoved.addListener(checkTabs);
  checkTabs();
};

/**
 * The firstCallback of the onInit event.
 */
nassh.App.prototype.onInit_ = function() {
  console.log('nassh: Application initialized: ' + chrome.runtime.getURL(''));
};
