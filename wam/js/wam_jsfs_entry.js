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
wam.jsfs.Entry.ops = {
  'LIST': ['addEntry', 'getStat', 'listEntryStats', 'partialResolve'],
  'OPEN': ['getStat', 'open'],
  'EXECUTE': ['getStat', 'execute']
};

wam.jsfs.Entry.subclass = function(opList) {
  var proto = Object.create(wam.jsfs.Entry.prototype);
  proto.opList = opList;
  wam.async(wam.jsfs.Entry.checkOpMethods, [null, proto]);

  return proto;
};

wam.jsfs.Entry.checkOpMethods = function(proto) {
  var opList = proto.opList;
  if (!opList || opList.length == 0)
    throw new Error('Missing opList property');

  var checkMethods = function(opname, nameList) {
    for (var i = 0; i < nameList.length; i++) {
      if (typeof proto[nameList[i]] != 'function')
          throw new Error('Missing ' + opname + ' method: ' + nameList[i]);
    }
  };

  for (var i = 0; i < opList.length; i++) {
    if (opList[i] in wam.jsfs.Entry.ops) {
      checkMethods(opList[i], wam.jsfs.Entry.ops[opList[i]]);
    } else {
      throw new Error('Unknown operation: ' + opList[i]);
    }
  }
};

wam.jsfs.Entry.prototype.can = function(opname) {
  return (this.opList.indexOf(opname) != -1);
};
