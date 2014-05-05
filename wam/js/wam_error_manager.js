// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.errorManager = {};
wam.errorManager.errorDefs_ = {};

wam.errorManager.defineError = function(errorName, argNames) {
  wam.errorManager.errorDefs_[errorName] = {
    'errorName': errorName, 'argNames': argNames
  };
};

wam.errorManager.defineErrors = function(/* ... */) {
  for (var i = 0; i < arguments.length; i++) {
    this.defineError(arguments[i][0], arguments[i][1]);
  }
};

wam.errorManager.normalize = function(value) {
  var errorName = value.errorName;
  var errorArg = value.errorArg;

  if (!name) {
    errorName = 'wam.Error.InvalidError';
    errorArg = {value: value};
  }

  if (!this.errorDefs_.hasOwnProperty(errorName)) {
    errorName = 'wam.Error.UnknownError';
    errorArg = {errorName: errorName, errorArg: arg};
  }

  var errorDef = this.errorDefs_[name];
  for (var argName in errorDef.argNames) {
    if (!argMap.hasOwnProperty(argName))
      argMap[argName] = null;
  }

  return {errorName: errorName, errorArg: errorArg};
};

wam.errorManager.createValue = function(name, argList) {
  var errorDef = this.errorDefs_[name];
  if (!errorDef)
    throw new Error('Unknown error name: ' + name);

  if (argList.length != errorDef.argNames.length) {
    throw new Error('Argument list length mismatch, expected ' +
                    errorDef.argNames.length + ', got ' + argList.length);
  }

  var value = {
    'errorName': errorDef.errorName,
    'errorArg': {}
  };

  for (var i = 0; i < argList.length; i++) {
    value['errorArg'][errorDef.argNames[i]] = argList[i];
  }

  return value;
};
