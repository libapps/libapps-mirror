// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.fs');

var nassh = {};

/**
 * True if nassh is running as a v2 app.
 */
nassh.v2 = !!chrome.app.window;

/**
 * Register a static initializer for nassh.*.
 *
 * @param {function} onInit The function lib.init() wants us to invoke when
 *     initialization is complete.
 */
lib.registerInit('nassh', function(onInit) {
  if (!nassh.defaultStorage) {
    var ary = navigator.userAgent.match(/\sChrome\/(\d\d)/);
    var version = parseInt(ary[1]);
    if (chrome.storage && chrome.storage.sync && version > 21) {
      nassh.defaultStorage = new lib.Storage.Chrome(chrome.storage.sync);
    } else {
      nassh.defaultStorage = new lib.Storage.Local();
    }
  }

  onInit();
});

nassh.test = function() {
  window.open(chrome.extension.getURL('html/nassh_test.html'));
};

/**
 * Return a formatted message in the current locale.
 *
 * @param {string} name The name of the message to return.
 * @param {Array} opt_args The message arguments, if required.
 */
nassh.msg = function(name, opt_args) {
  if (!chrome.i18n)
    return name;

  var rv = chrome.i18n.getMessage(name, opt_args);
  if (!rv)
    console.log('Missing message: ' + name);

  return rv;
};

/**
 * Load and parse the manifest file for this extension.
 */
nassh.loadManifest = function(onSuccess, opt_onError) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', '/manifest.json');

  var self = this;
  xhr.onloadend = function() {
    if (xhr.status == 200) {
      onSuccess(JSON.parse(xhr.responseText));
    } else {
      if (opt_onError)
        opt_onError(xhr.status);
    }
  };

  xhr.send();
};

/**
 * Request the persistent HTML5 filesystem for this extension.
 *
 * This will also create the /.ssh/ directory if it does not exits.
 *
 * @param {function(FileSystem, DirectoryEntry)} onSuccess The function to
 *     invoke when the operation succeeds.
 * @param {function(FileError)} opt_onError Optional function to invoke if
 *     the operation fails.
 */
nassh.getFileSystem = function(onSuccess, opt_onError) {
  function onFileSystem(fileSystem) {
    lib.fs.getOrCreateDirectory(fileSystem.root, '/.ssh',
                                onSuccess.bind(null, fileSystem),
                                lib.fs.err('Error creating /.ssh',
                                           opt_onError));
  }

  var requestFS = window.requestFileSystem || window.webkitRequestFileSystem;
  requestFS(window.PERSISTENT,
            16 * 1024 * 1024,
            onFileSystem,
            lib.fs.err('Error initializing filesystem', opt_onError));
};

/**
 * Import File objects into the HTML5 filesystem.
 *
 * @param {FileSysetm} fileSystem The FileSystem object to operate on.
 * @param {string} dest The target directory for the import.
 * @param {FileList} fileList A FileList object containing one or more File
 *     objects to import.
 */
nassh.importFiles = function(fileSystem, dest, fileList,
                             opt_onSuccess, opt_onError) {
  if (dest.substr(dest.length - 1) != '/')
    dest += '/';

  for (var i = 0; i < fileList.length; ++i) {
    var file = fileList[i];
    var targetPath = dest + file.name;
    lib.fs.overwriteFile(fileSystem.root, targetPath, file,
                         lib.fs.log('Imported: '+ targetPath, opt_onSuccess),
                         lib.fs.err('Error importing: ' + targetPath,
                                    opt_onError));
  }
};

/**
 * Export the current list of nassh connections, and any hterm profiles
 * they reference.
 *
 * This is method must be given a completion callback because the hterm
 * profiles need to be loaded asynchronously.
 *
 * @param {function(Object)} Callback to be invoked when export is complete.
 *   The callback will receive a plan js object representing the state of
 *   nassh preferences.  The object can be passed back to
 *   nassh.importPreferences.
 */
nassh.exportPreferences = function(onComplete) {
  var pendingReads = 0;
  var rv = {};

  var onReadStorage = function(terminalProfile, prefs) {
    rv.hterm[terminalProfile] = prefs.exportAsJson();
    if (--pendingReads < 1)
      onComplete(rv);
  };

  rv.magic = 'nassh-prefs';
  rv.version = 1;

  var nasshPrefs = new nassh.PreferenceManager();
  nasshPrefs.readStorage(function() {
    rv.nassh = nasshPrefs.exportAsJson();
    rv.hterm = {};

    var profileIds = nasshPrefs.get('profile-ids');
    if (profileIds.length == 0) {
      onComplete(rv);
      return;
    }

    for (var i = 0; i < profileIds.length; i++) {
      var nasshProfilePrefs = nasshPrefs.getChild('profile-ids', profileIds[i]);
      var terminalProfile = nasshProfilePrefs.get('terminal-profile');
      if (!terminalProfile)
        terminalProfile = 'default';

      if (!(terminalProfile in rv.hterm)) {
        rv.hterm[terminalProfile] = null;

        var prefs = new hterm.PreferenceManager(terminalProfile);
        prefs.readStorage(onReadStorage.bind(null, terminalProfile, prefs));
        pendingReads++;
      }
    }
  });
};

/**
 * Import a preferences object.
 *
 * This will not overwrite any existing preferences.
 *
 * @param {Object} prefsObject A preferences object created with
 *   nassh.exportPreferences.
 * @param {function()} opt_onComplete An optional callback to be invoked when
 *   the import is complete.
 */
nassh.importPreferences = function(prefsObject, opt_onComplete) {
  var pendingReads = 0;

  var onReadStorage = function(terminalProfile, prefs) {
    prefs.importFromJson(prefsObject.hterm[terminalProfile]);
    if (--pendingReads < 1 && opt_onComplete)
      opt_onComplete();
  };

  if (prefsObject.magic != 'nassh-prefs')
    throw new Error('Not a JSON object or bad value for \'magic\'.');

  if (prefsObject.version != 1)
    throw new Error('Bad version, expected 1, got: ' + prefsObject.version);

  var nasshPrefs = new nassh.PreferenceManager();
  nasshPrefs.importFromJson(prefsObject.nassh);

  for (var terminalProfile in prefsObject.hterm) {
    var prefs = new hterm.PreferenceManager(terminalProfile);
    prefs.readStorage(onReadStorage.bind(null, terminalProfile, prefs));
    pendingReads++;
  }
};

nassh.reloadWindow = function() {
  if (!nassh.v2) {
    document.location.hash = '';
    document.location.reload();
  } else {
    var appWindow = chrome.app.window.current();
    var bounds = appWindow.getBounds();
    var url = appWindow.contentWindow.location.pathname;
    chrome.app.window.create(url, { 'bounds': bounds });
    appWindow.close();
  }
};
