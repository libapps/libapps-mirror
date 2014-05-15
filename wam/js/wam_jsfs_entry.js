// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.jsfs.Entry = function() {};

/**
 * List of operation types that may be supported by a filesystem entry and the
 * methods they imply.
 *
 * All entries must support:
 *
 * - getStat(onSuccess, onError)
 *
 * Listable entries must support:
 *
 * - addEntry(name, entry, onSuccess, onError)
 * - listEntryStats(onSuccess)
 * - partialResolve(prefixList, pathList, onSuccess, onError)
 * - doUnlink(name, onSuccess, onError)
 *
 * Forwardable entries must support:
 *
 * - forwardExecute(arg)
 *   @param {Object} arg The forward argument.  Contains 'executeContext' and
 *     'forwardPath' properties for the local executeContext and target file
 *     relative to the containing file system, and the forwarded file system.
 *
 * - forwardList(arg, onSuccess, onError)
 *   @param {Object} arg The forward argument.  Contains 'fullPath' and
 *     'forwardPath' properties locating the target file relative to the
 *     containing file system, and the forwarded file system.
 *   @param {function(Object)} onSuccess The function to invoke with the wam
 *     'list' result if the call succeeds.
 *   @param {function(wam.Error)} onError
 *
 * - forwardOpen(arg)
 *   @param {Object} arg The forward argument.  Contains 'openContext' and
 *     'forwardPath' properties for the local wam.binding.fs.OpenContext and
 *     target file relative to the containing file system, and the forwarded
 *     file system.
 *
 * - forwardStat(arg, onSuccess, onError)
 *   @param {Object} arg The forward argument.  Contains 'fullPath' and
 *     'forwardPath' properties locating the target file relative to the
 *     containing file system, and the forwarded file system.
 *   @param {function(Object)} onSuccess The function to invoke with the wam
 *     'stat' result if the call succeeds.
 *   @param {function(wam.Error)} onError
 *
 * - forwardUnlink(arg, onSuccess, onError)
 *   @param {Object} arg The forward argument.  Contains 'fullPath' and
 *     'forwardPath' properties locating the target file relative to the
 *     containing file system, and the forwarded file system.
 *   @param {function(Object)} onSuccess The function to invoke with the wam
 *     'unlink' result if the call succeeds.
 *   @param {function(wam.Error)} onError
 */
wam.jsfs.Entry.ability = {
  'LIST': ['addEntry', 'getStat', 'listEntryStats', 'partialResolve',
           'doUnlink'],
  'OPEN': ['getStat'],
  'EXECUTE': ['getStat'],
  'FORWARD': ['forwardExecute', 'forwardList', 'forwardOpen',
              'forwardStat', 'forwardUnlink', 'getStat']
};

/**
 * Create a prototype object to use for a wam.jsfs.Entry subclass, mark it as
 * supporting the given abilities, and verify that it has the required methods.
 */
wam.jsfs.Entry.subclass = function(abilities) {
  var proto = Object.create(wam.jsfs.Entry.prototype);
  proto.abilities = abilities;
  wam.async(wam.jsfs.Entry.checkMethods_, [null, proto, (new Error()).stack]);

  return proto;
};

/**
 * Check that a wam.jsfs.Entry subclass has all the methods it's supposed to
 * have.
 */
wam.jsfs.Entry.checkMethods_ = function(proto, stack) {
  var abilities = proto.abilities;
  if (!abilities || abilities.length == 0)
    throw new Error('Missing abilities property, ' + stack);

  if (abilities.indexOf('FORWARD') != -1) {
    // Entries marked for FORWARD only need to support the FORWARD methods.
    // Additional abilities only advise what can be forwarded.
    abilities = ['FORWARD'];
  }

  var checkMethods = function(opname, nameList) {
    for (var i = 0; i < nameList.length; i++) {
      if (typeof proto[nameList[i]] != 'function')
          throw new Error('Missing ' + opname + ' method: ' + nameList[i]);
    }
  };

  for (var i = 0; i < abilities.length; i++) {
    if (abilities[i] in wam.jsfs.Entry.ability) {
      checkMethods(abilities[i], wam.jsfs.Entry.ability[abilities[i]]);
    } else {
      throw new Error('Unknown operation: ' + abilities[i]);
    }
  }
};

/**
 * Check if this entry supports the given ability.
 */
wam.jsfs.Entry.prototype.can = function(name) {
  return (this.abilities.indexOf(name) != -1);
};
