// Copyright 2025 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Omnibox handling logic.
 */

import {lib} from '../../libdot/index.js';

import {localize} from './nassh.js';
import {
  LocalPreferenceManager, PreferenceManager,
} from './nassh_preference_manager.js';

/**
 * Handler for custom omnibox integration.
 *
 * @see https://developer.chrome.com/docs/extensions/reference/api/omnibox
 * @see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/omnibox
 */
export class OmniboxHandler {
  /**
   * @param {{
   *   omnibox: (!typeof chrome.omnibox),
   *   storage: (!lib.Storage),
   * }=} settings The omnibox instance to bind to & storage for settings.
   */
  constructor({omnibox, storage} = {}) {
    this.omnibox_ = omnibox;

    this.earlyData_ = null;
    this.earlyListener_ = null;
    this.initialized_ = false;

    this.prefs_ = new PreferenceManager(storage);
    this.localPrefs_ = new LocalPreferenceManager();

    this.matches_ = [];
    this.default_ = null;
  }

  /**
   * Bind callbacks early on synchronously.
   *
   * We have to listen for entered event so we don't miss it.  We'll clean this
   * up later on during the full install.
   */
  earlyInstall() {
    this.earlyListener_ = this.earlyOnInputEntered_.bind(this);
    this.omnibox_.onInputEntered.addListener(this.earlyListener_);
  }

  /**
   * Remember omnibox input before we were ready.
   *
   * @param {string} text The text to operate on.
   * @param {string} disposition Mode the user wants us to open as.
   */
  earlyOnInputEntered_(text, disposition) {
    this.earlyData_ = {text, disposition};
  }

  /**
   * Bind our callbacks to the omnibox and initialize all state.
   */
  async install() {
    if (this.initialized_) {
      return;
    }

    await this.prefs_.readStorage();
    await this.localPrefs_.readStorage();

    this.setDefault_();
    this.omnibox_.onInputStarted.addListener(this.onInputStarted_.bind(this));
    this.omnibox_.onInputChanged.addListener(this.onInputChanged_.bind(this));
    this.omnibox_.onInputEntered.addListener(this.onInputEntered_.bind(this));
    this.omnibox_.onInputCancelled.addListener(
        this.onInputCancelled_.bind(this));

    // If the user triggered omnibox while we were sleeping, run it now.
    if (this.earlyListener_ !== null) {
      this.omnibox_.onInputEntered.removeListener(this.earlyListener_);
      this.earlyListener_ = null;
    }
    if (this.earlyData_ !== null) {
      this.onInputEntered_(this.earlyData_.text, this.earlyData_.disposition);
      this.earlyData_ = null;
    }

    this.initialized_ = true;
  }

  /**
   * Set the default help text in the omnibox when completing an ssh connection.
   */
  setDefault_() {
    this.omnibox_.setDefaultSuggestion({
      description: localize('OMNIBOX_DEFAULT'),
    });
  }

  /**
   * Callback when user first interacts with the ssh shortcut.
   */
  onInputStarted_() {
    this.matches_.length = 0;
    this.default_ = null;

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
      this.matches_.push(profileIdToOmni(ids[i]));
    }

    // When first installed, there won't be a last profile.
    const lastProfile = this.localPrefs_.get('connectDialog/lastProfileId');
    if (lastProfile) {
      this.default_ = profileIdToOmni(lastProfile);
    }
  }

  /**
   * Callback when the user changes the input at all.
   *
   * @param {string} text Current input in the omnibox.
   * @param {function(!Array<{content: string, description: string}>)} suggest
   *     Function for us to call to notify of our matches against the text.
   */
  onInputChanged_(text, suggest) {
    const resultsUhp = [];
    const resultsDescLeading = [];
    const resultsDescSubstr = [];

    this.matches_.forEach((match) => {
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
      if (this.default_) {
        results.unshift({
          content: `profile-id=${this.default_.id}`,
          description: lib.f.replaceVars('%escapeHTML(uhp): %escapeHTML(desc)',
                                         this.default_),
        });
      }
    }
    if (results.length) {
      suggest(results);
    }
  }

  /**
   * Callback when the user has finish entering text.
   *
   * See the omnibox source for what key strokes generate which dispositions.
   * https://chromium.googlesource.com/chromium/src/+/69.0.3487.1/chrome/browser/ui/views/omnibox/omnibox_view_views.cc#1188
   *
   * @param {string} text The text to operate on.
   * @param {string} disposition Mode the user wants us to open as.
   */
  onInputEntered_(text, disposition) {
    // If the user types out the profile name exactly, connect to it.  It might
    // overlap with a valid URI, but if that's a problem, they can change the
    // description to something else.
    for (let i = 0; i < this.matches_.length; ++i) {
      const match = this.matches_[i];

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
  }

  /**
   * Callback when the user has aborted input.
   */
  onInputCancelled_() {
    // this.setDefault_(); needed?
    this.matches_.length = 0;
    this.default_ = null;
  }
}
