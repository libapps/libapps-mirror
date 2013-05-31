// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * The base class for things that can live in the filesystem.
 */
lib.wa.fs.Entry = function() {
  this.on = {};

  this.registerMessages(lib.wa.fs.Entry.on);
};

/**
 * True if this entry represents a local resource, false if it's on the
 * other end of a lib.wa.Channel.
 */
lib.wa.fs.Entry.prototype.isLocal = true;

/**
 * Register a set of callbacks.
 *
 * This is how the lib.wa.fs.Entry.on functions get registered.  Subclasses
 * can use it too.
 */
lib.wa.fs.Entry.prototype.registerMessages = function(obj) {
  for (var key in obj) {
    if (!this.on.hasOwnProperty(key))
      this.on[key] = new lib.Event();

    this.on[key].addListener(obj[key], this);
  }
};

/**
 * Take an incoming message and route it to one of the registered handlers.
 */
lib.wa.fs.Entry.prototype.dispatchMessage = function(path, msg) {
  msg.meta.path = path;
  msg.dispatch(this, this.on);
};

/**
 * Message handlers reachable via dispatchMessage.
 */
lib.wa.fs.Entry.on = {};
