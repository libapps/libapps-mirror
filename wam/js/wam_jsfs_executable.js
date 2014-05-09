// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 */
wam.jsfs.Executable = function(callback) {
  wam.jsfs.Entry.call(this);
  this.callback_ = callback;
};

wam.jsfs.Executable.prototype = wam.jsfs.Entry.subclass(['EXECUTE']);

wam.jsfs.Executable.prototype.getStat = function(onSuccess, onError) {
  wam.async(onSuccess,
            [null,
             { abilities: this.abilities,
               source: 'jsfs'}]);
};

wam.jsfs.Executable.prototype.execute = function(executeContext, arg) {
  this.callback_(executeContext);
};
