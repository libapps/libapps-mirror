// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.jsfs.Entry = function() {
};

/**
 * List of operation types that may be supported by a filesystem entry and the
 * methods they imply.
 */
wam.jsfs.Entry.ability = {
  'LIST': ['addEntry', 'getStat', 'listEntryStats', 'partialResolve'],
  'OPEN': ['getStat', 'open'],
  'EXECUTE': ['getStat', 'execute'],
  'FORWARD': ['getStat', 'forwardStat', 'forwardList', 'forwardExecute']
};

wam.jsfs.Entry.subclass = function(abilities) {
  var proto = Object.create(wam.jsfs.Entry.prototype);
  proto.abilities = abilities;
  wam.async(wam.jsfs.Entry.checkMethods, [null, proto]);

  return proto;
};

wam.jsfs.Entry.checkMethods = function(proto) {
  var abilities = proto.abilities;
  if (!abilities || abilities.length == 0)
    throw new Error('Missing abilities property');

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

wam.jsfs.Entry.prototype.can = function(opname) {
  return (this.abilities.indexOf(opname) != -1);
};
