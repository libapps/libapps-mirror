// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

var wam = {};

/**
 * This is filled out during the concat process, either from
 * concat/wam_test_deps.concat or concat/wam_fs.concat
 */
wam.changelogVersion = null;

/**
 * Namespace for transport classes.
 */
wam.transport = {};

/**
 * Namespace for the binding classes that sit between concrete implementations.
 */
wam.binding = {};

/**
 * Namespace for the Request/Response classes that marshal bindings over a
 * wam connection.
 */
wam.remote = {};

wam.remote.closeTimeoutMs = 5 * 1000;

/**
 * Shortcut to wam.errorManager.createValue.
 */
wam.mkerr = function(name, argList) {
  return wam.errorManager.createValue(name, argList);
};

/**
 * Promise based setImmediate polyfill.
 */
wam.setImmediate = function(f) {
  var p = new Promise(function(resolve) { resolve() });
  p.then(f)
   .catch(function(ex) {
       if ('message' in ex && 'stack' in ex) {
         console.warn(ex.message, ex.stack);
       } else {
         if (lib && lib.TestManager &&
             ex instanceof lib.TestManager.Result.TestComplete) {
           // Tests throw this non-error when they complete, we don't want
           // to log it.
           return;
         }

         console.warn(ex);
       }
     });
};

/**
 * Shortcut for setImmediate of a function bound to static args.
 */
wam.async = function(f, args) {
  wam.setImmediate(f.bind.apply(f, args));
};


/**
 * Make a globally unique id.
 *
 * TODO(rginda) We probably don't need to use crypto entropy for this.
 */
wam.guid = function() {
  var ary = new Uint8Array(16)
  window.crypto.getRandomValues(ary);

  var rv = '';
  for (var i = 0; i < ary.length; i++) {
    var byte = ary[i].toString(16);
    if (byte.length == 2) {
      rv += byte;
    } else {
      rv += '0' + byte;
    }
  }

  return rv;
};
