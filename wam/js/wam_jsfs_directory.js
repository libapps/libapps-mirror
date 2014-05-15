// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * A wam.jsfs.Entry subclass that represents a directory.
 */
wam.jsfs.Directory = function() {
  wam.jsfs.Entry.call(this);
  this.entries_ = {};
  this.mtime_ = 0;
};

/**
 * We're an Entry subclass that is able to LIST.
 */
wam.jsfs.Directory.prototype = wam.jsfs.Entry.subclass(['LIST']);

/**
 * Add a new wam.jsfs.Entry to this directory.
 *
 * This is a jsfs.Entry method needed as part of the 'LIST' action.
 *
 * @param {string} name The name of the entry to add.
 * @param {wam.jsfs.Entry} entry The Entry subclass to add.
 * @param {function()} onSuccess
 * @param {function(wam.Error)} onError
 */
wam.jsfs.Directory.prototype.addEntry = function(
    name, entry, onSuccess, onError) {
  if (!name) {
    wam.async(onError,
              [null, wam.mkerr('wam.FileSystem.Error.InvalidPath', [name])]);
    return;
  }

  if (name in this.entries_) {
    wam.async(onError,
              [null, wam.mkerr('wam.FileSystem.Error.FileExists', [name])]);
    return;
  }

  wam.async(function() {
      this.entries_[name] = entry;
      onSuccess();
    }.bind(this));
};

/**
 * Remove an entry from this directory.
 *
 * This is a jsfs.Entry method needed as part of the 'LIST' action.
 *
 * @param {string} name The name of the entry to remove.
 * @param {function()} onSuccess
 * @param {function(wam.Error)} onError
 */
wam.jsfs.Directory.prototype.doUnlink = function(name, onSuccess, onError) {
  wam.async(function() {
      if (name in this.entries_) {
        delete this.entries_[name];
        onSuccess(null);
      } else {
        onError(wam.mkerror('wam.FileSystem.Error.NotFound', [name]));
      }
    }.bind(this));
};

wam.jsfs.Directory.prototype.listEntryStats = function(onSuccess) {
  var rv = {};

  var statCount = Object.keys(this.entries_).length;
  if (statCount == 0)
    wam.async(onSuccess, [null, rv]);

  var onStat = function(name, stat) {
    rv[name] = {stat: stat};
    if (--statCount == 0)
      onSuccess(rv);
  };

  for (var key in this.entries_) {
    this.entries_[key].getStat(onStat.bind(null, key),
                               onStat.bind(null, key, null));
  }
};

wam.jsfs.Directory.prototype.getStat = function(onSuccess, onError) {
  wam.async(onSuccess,
            [null,
             { abilities: this.abilities,
               count: Object.keys(this.entries_).length,
               source: 'jsfs'
             }]);
};

wam.jsfs.Directory.prototype.partialResolve = function(
    prefixList, pathList, onSuccess, onError) {
  var entry = this.entries_[pathList[0]];
  if (!entry) {
    // The path doesn't exist past this point, signal our partial success.
    wam.async(onSuccess, [null, prefixList, pathList, this]);

  } else {
    prefixList.push(pathList.shift());

    if (pathList.length == 0) {
      // We've found the full path.
      wam.async(onSuccess, [null, prefixList, pathList, entry]);

    } else if (entry.can('LIST') && !entry.can('FORWARD')) {
      // We're not done, descend into a child directory to look for more.
      entry.partialResolve(prefixList, pathList, onSuccess, onError);
    } else {
      // We found a non-directory entry, but there are still remaining path
      // elements.  We'll signal a partial success and let the caller decide
      // if this is fatal or not.
      wam.async(onSuccess, [null, prefixList, pathList, entry]);
    }
  }
};
