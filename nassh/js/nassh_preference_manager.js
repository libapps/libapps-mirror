// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.f');

/**
 * PreferenceManager subclass managing global NaSSH preferences.
 *
 * This is currently just an ordered list of known connection profiles.
 */
nassh.PreferenceManager = function(opt_storage) {
  var storage = opt_storage || nassh.defaultStorage;
  lib.PreferenceManager.call(this, storage, '/nassh/');

  this.defineChildren('profile-ids', function(parent, id) {
    return new nassh.ProfilePreferenceManager(parent, id);
  });

  this.definePreferences([
    /**
     * The last version we showed release notes for.
     */
    ['welcome/notes-version', ''],

    /**
     * How many times we've shown the current release notes.
     */
    ['welcome/show-count', 0],
  ]);
};

nassh.PreferenceManager.prototype =
    Object.create(lib.PreferenceManager.prototype);
nassh.PreferenceManager.constructor = nassh.PreferenceManager;

nassh.PreferenceManager.prototype.createProfile = function() {
  return this.createChild('profile-ids');
};

nassh.PreferenceManager.prototype.removeProfile = function(id) {
  return this.removeChild('profile-ids', id);
};

nassh.PreferenceManager.prototype.getProfile = function(id) {
  return this.getChild('profile-ids', id);
};

/**
 * lib.PreferenceManager subclass managing per-connection preferences.
 */
nassh.ProfilePreferenceManager = function(parent, id) {
  lib.PreferenceManager.call(this, parent.storage,
                             '/nassh/profiles/' + id);

  this.id = id;

  this.definePreferences
  ([
    /**
     * The free-form description of this connection profile.
     */
    ['description', ''],

    /**
     * The username.
     */
    ['username', ''],

    /**
     * The hostname or IP address.
     */
    ['hostname', ''],

    /**
     * The port, or null to use the default port.
     */
    ['port', null],

    /**
     * The relay host, hardcoded to use nassh.GoogleRelay at the moment.
     */
    ['relay-host', ''],

    /**
     * The optional relay port.
     */
    ['relay-port', ''],

    /**
     * Options string for relay.
     * Supported values: --use-xhr and --use-ssl.
     */
    ['relay-options', ''],

    /**
     * The private key file to use as the identity for this extension.
     *
     * Must be relative to the /.ssh/ directory.
     */
    ['identity', ''],

    /**
     * The argument string to pass to the ssh executable.
     *
     * Use '--' to separate ssh arguments from the target command/arguments.
     */
    ['argstr', ''],

    /**
     * The terminal profile to use for this connection.
     */
    ['terminal-profile', ''],

    /**
     * The base path used when mounting via SFTP.
     */
    ['mount-path', ''],

    /**
     * The appid to which to pass auth-agent requests.
     */
    ['auth-agent-appid', null],
   ]);
};

nassh.ProfilePreferenceManager.prototype =
    Object.create(lib.PreferenceManager.prototype);
nassh.ProfilePreferenceManager.constructor = nassh.ProfilePreferenceManager;

nassh.ProfilePreferenceManager.prototype.readStorage = function(opt_callback) {
  var appendOption = (str) => {
    var options = this.get('relay-options');
    if (options) {
      options += ' ' + str;
    } else {
      options = str;
    }

    this.set('relay-option', options);
  };

  var onRead = () => {
    var host = this.get('relay-host');
    if (host) {
      console.warn('Merging relay-host preference with relay-options');
      this.reset('relay-host');
      appendOption('--proxy-host=' + host);
    }

    var port = this.get('relay-port');
    if (port) {
      this.reset('relay-port');
      console.warn('Merging relay-host preference with relay-options');
      appendOption('--proxy-port=' + port);
    }

    if (opt_callback)
      opt_callback();
  };

  lib.PreferenceManager.prototype.readStorage.call(this, onRead);
};
